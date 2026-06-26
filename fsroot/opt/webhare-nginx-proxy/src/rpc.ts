import * as fs from "fs";
import { Agent, request } from "undici";

import { currentConfig, type Client, waitForConfigChange } from "./config.ts";
import * as Tools from "./tools.ts";
import * as NginxConfig from "./nginx-config.ts";
import { omit, sleep } from "@webhare/std";

let currentversion = '';

const verificationDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

async function verifyClient(reverseaddress: string, verificationurl: string) {
  const parsed_reverseaddr = new URL(reverseaddress);
  const parsed_verificationurl = new URL(verificationurl);

  const target = new URL(reverseaddress);
  target.pathname = parsed_verificationurl.pathname;
  target.search = parsed_verificationurl.search;

  try {
    const { statusCode, body } = await request(target, {
      method: "GET",
      dispatcher: verificationDispatcher,
      signal: AbortSignal.timeout(10000),
      headers: {
        Host: parsed_verificationurl.hostname,
        "X-Forwarded-Proto": "https"
      }
    });

    const responseBody = await body.text();

    if (statusCode === 200 && responseBody === "ok")
      return;

    if (responseBody === "Wrong proxy verification code") {
      console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: wrong verification code");
      throw new Error("Proxy verification failed, wrong verification code");
    }

    if (statusCode === 404) {
      console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: 404, domain probably not hosted on reverse address");
      throw new Error("Proxy verification failed, got 404");
    }

    console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed: http code " + statusCode + " and unrecognized response");
    throw new Error("Proxy verification failed, http code " + statusCode + " and unrecognized response");
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Proxy verification failed"))
      throw e;

    if (e instanceof Error && e.name === "AbortError")
      throw new Error("Timeout for retrieving verification (waited 10 seconds)");

    const message = e instanceof Error ? e.message : String(e);
    console.log("Verification of reverse addr", reverseaddress, "with url", verificationurl, "failed:", message);
    throw new Error(message);
  }
}

export async function ping(echo: unknown) {
  return echo;
}

// Used to test connectivity
export async function test(reverseaddress: string, verificationurl: string) {
  try {
    // Connect to the reverse address via the verification url
    await verifyClient(reverseaddress, verificationurl);
  } catch (e) {
    return { success: false, code: "verificationfailed" };
  }

  return { success: true };
}

// registerProxyClient is called by a webhare to register the hosts it needs forwarded
export async function registerProxyClient(newconfig: Client & { secretkey: string; verificationurl: string }) {
  if (arguments.length !== 1)
    throw new Error("Expected one parameter");

  if (!newconfig.id)
    throw new Error("Require a installation id");

  if (!newconfig.reverseaddress || !newconfig.verificationurl)
    throw new Error("Require a reverse address and verificationurl");

  const client = currentConfig.clients.find(i => i.id === newconfig.id);

  /* The clients update lastset whenever their proxy configuration is explicitly changed by a sysop
     Zombie servers may exist (uncontrollable WebHares which still know about the proxy) which may know about lastset
     By rejecting any changed made by servers with an older lastset than we saw earlier we protect the proxy against having
     its configuration reverted by a zombie */
  if (client && client.lastset) //we have a previous configuration that's protected by a timestamp
    if (!newconfig.lastset || newconfig.lastset < client.lastset) //and this new configuration is older than that
      throw new Error(`Refusing configuration with registration timestamp '${newconfig.lastset || 'not provided'}' as we already have a registration with '${client.lastset}'`);

  /* Connect to the reverse address via the verification url. this protects us against servers which do not know their
     own IP address/hostname, eg a 'restore' server which still has a valid lastset */
  await verifyClient(newconfig.reverseaddress, newconfig.verificationurl);

  // Remove id and secretkey from newconfig
  const new_client: Client = omit({ ...newconfig, lastregistration: 0 }, ["secretkey", "verificationurl"]);

  // Generate the newconfig from all last valid configs, but with the new newconfig for this client
  const configfile = NginxConfig.generateNginxConfig(new_client);

  // Test that generated newconfig file
  const testresult = await NginxConfig.testNginxConfig(configfile);
  if (!testresult)
    throw new Error("Configuration did not validate");

  // Apply the changes to the client, and generate+deploy the final newconfig
  const clientIdx = currentConfig.clients.findIndex(i => i.id === newconfig.id);
  new_client.lastregistration = Date.now();
  if (clientIdx === -1)
    currentConfig.clients.push(new_client);
  else
    currentConfig.clients[clientIdx] = new_client;

  await NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig(), true);

  const local_ips = Tools.getLocalIPs();

  console.log("Applied configuration from: " + newconfig.id);
  return { success: true, local_ips: local_ips };
}

export async function guiUnregisterProxyClient(servername: string) {
  if (arguments.length !== 1)
    throw new Error("Expected one parameter");

  const client = currentConfig.clients.find(i => i.id === servername);
  if (client)
    currentConfig.clients.splice(currentConfig.clients.indexOf(client), 1);

  await NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig(), true);

  console.log("Deleted server with id: " + servername);
  return { success: true, found: Boolean(client) };
}

export async function unregisterProxyClient(servername: string, reverseaddress: string, verificationurl: string) {
  try {
    // Connect to the reverse address via the verification url
    await verifyClient(reverseaddress, verificationurl);
  } catch (e) {
    return { success: false, code: "verificationfailed" };
  }

  const client = currentConfig.clients.find(i => i.id === servername);
  if (!client)
    return { success: false, code: "notfound" };

  currentConfig.clients.splice(currentConfig.clients.indexOf(client), 1);

  await NginxConfig.applyNginxConfig(NginxConfig.generateNginxConfig());

  console.log("Deleted server with id: " + servername);
  return { success: true, code: "ok" };
}

export async function getGUIState(counter: number) {
  await Promise.race([waitForConfigChange(counter), sleep(10000)]);

  return (
    {
      success: true,
      counter: currentConfig.counter,
      clients: currentConfig.clients.map(c => {
        return (
          {
            id: c.id,
            lastregistration: c.lastregistration,
            lastset: c.lastset,
            hosts: c.hosts.map(host => ({ servernames: host.servernames, with_cert: Boolean(host.ssl_keypair) }))
          });
      }),
      currentversion: currentversion
    });
}

try {
  const base = Tools.getFSPath("/opt/container/etc");
  currentversion = fs.readFileSync(base + "/proxy-branch").toString() + " " + fs.readFileSync(base + "/proxy-version").toString();
} catch (e) {
}

export const rpcs = {
  ping,
  test,
  registerProxyClient,
  unregisterProxyClient,
  guiUnregisterProxyClient,
  getGUIState,
};
