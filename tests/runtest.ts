import { sleep } from '@webhare/std';
import * as http from 'http';
import { networkInterfaces } from 'os';
import undici from 'undici';

const config =
{
  PROXYIP: process.env.PROXYIP,
  CONNECTIP: process.env.CONNECTIP || "",
  PORT_80: process.env.PORT_80 || "80",
  PORT_443: process.env.PORT_443 || "443",
  CONNECTPORT: process.env.CONNECTPORT || "1024",
  PROXYKEY: process.env.PROXYKEY,
  EXPECTSEENCONNECTIP: process.env.EXPECTSEENCONNECTIP
};

if (!config.CONNECTIP) {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets))
    if (nets[name] && nets[name]?.[0].address.startsWith("172.17."))
      config.CONNECTIP = nets[name]![0].address;
  if (!config.CONNECTIP)
    throw new Error(`Unable to determine connect IP`);
}

function requestListener(req: http.IncomingMessage, res: http.ServerResponse) {
  console.log(`incoming request: ${req.url}`);
  if (req.url == "/verify/ok") {
    res.writeHead(200);
    res.end("ok");
  } else if (req.url == "/verify/fail") {
    res.writeHead(200);
    res.end("Wrong proxy verification code");
  } else if (req.url?.startsWith("/verify/")) {
    res.writeHead(404);
    res.end("Hello world");
  } else {
    if (req.url && /addremoteip/.exec(req.url)) {
      res.setHeader("content-type", "text/html");
      res.setHeader("x-webhare-proxyoptions", ",addremoteip,");
    }

    res.writeHead(200);
    res.end("Hello world: " + req.url + " on " + req.headers.host);
  }
}

async function test() {
  // wait 1 minute for server to start
  for (let i = 0; i < 600; ++i) {
    console.log(`[runtests] Waiting for proxy adminhost to respond, try ${i}`);
    try {
      await undici.request(`http://${config.PROXYIP}:${config.PORT_80}/`,
        {
          headers: { host: 'admin.example.com' }
        });
      break;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`[runtests] Proxy adminhost is active`);

  let response = await undici.request(`http://${config.PROXYIP}:${config.PORT_80}/`,
    {
      headers: { host: 'admin.example.com' }
    });

  let responsebody = await response.body.text();
  if (responsebody != "adminhost\n") {
    console.log({ response, responsebody });
    throw new Error(`Expected 'adminhost\n' as response body`);
  }

  //wait for it to be pingable
  for (let i = 0; i < 600; ++i) {
    console.log(`[runtests] Waiting for underlying service, try ${i}`);
    const rpcResponse = await undici.request(`http://${config.PROXYIP}:${config.PORT_80}/admin/rpc`,
      {
        headers: {
          host: 'admin.example.com',
          "content-type": 'application/json',
          'Authorization': 'Basic ' + Buffer.from(`webhare:${config.PROXYKEY}`).toString('base64')
        },
        method: 'POST',
        body: JSON.stringify({
          method: "ping",
          params: [42],
        })
      }
    );
    console.log({ response: rpcResponse }, await rpcResponse.body.text());
    if (rpcResponse.statusCode === 200)
      break;

    await sleep(100);
  }

  const server = http.createServer(requestListener);
  server.listen(parseInt(config.CONNECTPORT), config.CONNECTIP);

  response = await undici.request(`http://${config.PROXYIP}:${config.PORT_80}/admin/rpc`,
    {
      headers: {
        host: 'admin.example.com',
        "content-type": 'application/json',
        'Authorization': 'Basic ' + Buffer.from(`webhare:${config.PROXYKEY}`).toString('base64')
      },
      method: 'POST',
      body: JSON.stringify(
        {
          method: "registerProxyClient",
          params:
            [
              {
                id: 'test1',
                verificationurl: `http://${config.CONNECTIP}:${config.CONNECTPORT}/verify/ok`,
                reverseaddress: `http://${config.CONNECTIP}:${config.CONNECTPORT}`,
                certificates: [
                  {
                    "name": "certbot-test2.example.com",
                    "keyfile": "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDXc6GPYpW4uuul\nGYl1XXfPLo/MAdVPdLZLb2pXu8J6yLGwaiYfS7AMAbi+ZSFJIT7u9W24RBI15mwg\n5ZDlHLivXMtg2FZ92sf9H3JWAw6PHbL3JyZ8lDCXdZeKv5ToAtyIgrhgoWrOTCh4\nHnfvOfP6eJOJU5c11iFijhIrCyG60rTjsQ6nBiVL+4K8o+D7LF2xd994zwaTF9ZD\nUlx1Ul20FHCcfdxrIRY0+IbIczMRVt4mUuxpLNMWua5HQdBtLJ+iIDcyyZ1jUX61\nWwRVu7iUxq+BUUX1/gxPjNRE0FnJhXYs6oWBH5DIasw9Wt6FwIpYlWXgGMcmd16n\nZS6PMsiJAgMBAAECggEAGGJSnmkEs3XaTiL8Au+7a9Qj+62YcAfwSszXDwtlySI2\nNBZrbp7RE6bNOyU0dXOhDQfzbUes/PMxeS6qLbgIsfYxYWpSradJe50nwlLRvsJY\ney7v5Okbr8SkDFS+/Fw4i+2pguw565PEf8XJAqb/NTGY1xHCGxp7SE12gm8d1+gk\nLAE096nL9LLuUp/mUfu7QG4Y4gzMYPLpO6d9IMNm6yNxTz14RKn9BiDfdfNetGsp\nmDgnARtiHgA/qzyztXA+Batc1DX6K+8uaAdHUjUwXgUt9EVEcGZ5mZcWkyfRdTXj\noFDOZbyAYMEw63V3DIhNnuF5eKGy2XklpetjsgNihQKBgQD/78hHpvr+hmOhMXWY\njg8R7peQ4PO5GmhK+/Vwzz9PcusOP5O778LElkLZVL1sENrBM6VB/nwaXVeb7oZ0\nruzVVNeFpcJUvFRT5gnajPu8TN6iYJucviimgW5ZP6Z59RBQJc7PrcOLvZqBsfTE\nifcf0tKE8sp7fmwWK5VnanJjJQKBgQDXgUiL4cYwJrYbJVbSWUjGkMry/wfJAZoY\nivomB4G+sH3nC9b/RBxu+F9R8Z+dKSoQWrirANA+FQgJIb8l7kb84HTLR1V2XoyA\nVlaumos19JZzvXKrow4CbZXMgh34v4V87WOPtAqWmMbLNUOfIWvBt1QyZw6m8L1W\nX499yYCElQKBgQCaBKODMyKSry8fnxMElmDNSsbdQfKJrzGaBlxi4eVYm3CG542x\nKI0OHtrlzNAdS1tJrxnBSDNI7mk9hmJVr7sIeoEkhWcX9SnOP34ojnUjkSLdlsOu\npOTzpqpQfTRi6i5B/S6i3g/ydUyYxg3lhJ06AnX72dwuSxsikGHdlTp3HQKBgQCY\np+QT8qLJiSKGqDSQXN7Iidi5uR5yrMfTit8YAUlPIwaMnD54JG9fzGD5UweV9Irv\netRFjhX1ZECE93rIC7oNd5JETQulBeTRJFfS53alidTpt9F6884Auk/axnEku8Z7\ncE2OhiLZ+u8XE2wLVUlXt93UtlwStYXpoVer6wk24QKBgQDxKwlc6L86MkcVJAjo\nR0wYfJJoEhU896ZsYqqbTClllv+kN7Y/9XmRsoLRjY6k4J7Xz3QJQ6G4+7GU9fhd\naFaTo5kLWYU5/vYYaU8YStDq62XZe6m2XUvAzTNw1Q/YvY52d/cvrl7hVm8UMa6w\nPnp555xQM/ykaGhL6v0mCITFcA==\n-----END PRIVATE KEY-----\n",
                    "chainfile": "-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIQcSY5FOkMSkE2xfcjTL+eezANBgkqhkiG9w0BAQsFADBd\nMQswCQYDVQQLDAJ0MjELMAkGA1UEBhMCTkwxCzAJBgNVBAgMAnQyMQswCQYDVQQH\nDAJ0MjELMAkGA1UECgwCdDIxGjAYBgNVBAMMEXRlc3QyLmV4YW1wbGUuY29tMB4X\nDTIzMDcxMDE5NDYyNloXDTQ0MDcxMDE5NDYwMFowXTELMAkGA1UECwwCdDIxCzAJ\nBgNVBAYTAk5MMQswCQYDVQQIDAJ0MjELMAkGA1UEBwwCdDIxCzAJBgNVBAoMAnQy\nMRowGAYDVQQDDBF0ZXN0Mi5leGFtcGxlLmNvbTCCASIwDQYJKoZIhvcNAQEBBQAD\nggEPADCCAQoCggEBANdzoY9ilbi666UZiXVdd88uj8wB1U90tktvale7wnrIsbBq\nJh9LsAwBuL5lIUkhPu71bbhEEjXmbCDlkOUcuK9cy2DYVn3ax/0fclYDDo8dsvcn\nJnyUMJd1l4q/lOgC3IiCuGChas5MKHged+858/p4k4lTlzXWIWKOEisLIbrStOOx\nDqcGJUv7gryj4PssXbF333jPBpMX1kNSXHVSXbQUcJx93GshFjT4hshzMxFW3iZS\n7Gks0xa5rkdB0G0sn6IgNzLJnWNRfrVbBFW7uJTGr4FRRfX+DE+M1ETQWcmFdizq\nhYEfkMhqzD1a3oXAiliVZeAYxyZ3XqdlLo8yyIkCAwEAAaNgMF4wHAYDVR0RBBUw\nE4IRdGVzdDIuZXhhbXBsZS5jb20wHQYDVR0OBBYEFF0mwzPaHr6A0ZE+qI6iXEpw\nKGr/MB8GA1UdIwQYMBaAFF0mwzPaHr6A0ZE+qI6iXEpwKGr/MA0GCSqGSIb3DQEB\nCwUAA4IBAQBgOHnPClByVXFh1/3KUZfmUIdQ506JD0n30Jm7VXBkPBYyi88/q1xD\nGJRJi3Yz6Wb2RVn2PjahjOlprMOUAMdjxqW3Ir3goa9jllY/qSrbsWFHuznrGfKH\no4lcg1y0Ng0cDMtfVPlrWpeKnRbR3IPeBHnzFFZt8MLJBJ7qrK/iVTTg6pkmnrNE\nFDL3BiOOQE8TJMYC/3Sd5vjKu8FK8wGf2EFJDY9Q1/IrMY1YlgciOPr8QzpXOGIi\n2t8nEqHitNjeoRIGx/Q7gfGIK9Fc2mh0zgZDeHcIubvqbJZlUwapcWMFEFZrasuJ\ne0++IZQuvqjHx1F0qkYwKpsJpt5+Gc08\n-----END CERTIFICATE-----\n\n"
                  }
                ],
                proxyid: 15,
                hosts:
                  [
                    {
                      ports:
                        [{ port: 80 }],
                      servernames: ["test.example.com"]
                    },
                    {
                      ports:
                        [{ port: 80 }, { port: 443, ssl: true }],
                      servernames: ["test2.example.com"],
                      "ssl_keypair": "certbot-test2.example.com"
                    }
                  ]
              }
            ]
        })
    });

  if (response.statusCode != 200)
    throw new Error(`Unexpected status return code ${response.statusCode}`);

  console.log(`registration ok`);

  // wait 10 secs for the proxy to reload
  for (let i = 0; i < 100; ++i) {
    const url = `http://${config.PROXYIP}:${config.PORT_80}/normalrequest`;
    console.log(`wait reload try ${i} ${url}`);
    response = await undici.request(url,
      {
        headers: { host: 'test.example.com' },
        method: 'GET'
      });
    if (response.statusCode != 404)
      break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  responsebody = await response.body.text();

  if (response.statusCode != 200)
    throw new Error(`Unexpected status return code ${response.statusCode}`);
  if (responsebody != "Hello world: /normalrequest on test.example.com")
    throw new Error(`Unexpected body: '${responsebody}'`);

  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  response = await undici.request(`https://${config.PROXYIP}:${config.PORT_443}/normalrequest`,
    {
      headers: { host: 'test2.example.com' },
      method: 'GET'
    });

  if (response.statusCode != 200)
    throw new Error(`Unexpected status return code ${response.statusCode}`);

  responsebody = await response.body.text();
  if (responsebody != "Hello world: /normalrequest on test2.example.com")
    throw new Error(`Unexpected body: '${responsebody}'`);

  response = await undici.request(`http://${config.PROXYIP}:${config.PORT_80}/normalrequest/addremoteip`,
    {
      headers: { host: 'test.example.com' },
      method: 'GET'
    });

  const expect_servertiming = `remoteip;desc="${config.EXPECTSEENCONNECTIP || config.CONNECTIP}"`;
  if (response.headers["server-timing"] != expect_servertiming)
    throw new Error(`Server-timing returned header is not as expected, expect ${JSON.stringify(expect_servertiming)}, got ${JSON.stringify(response.headers["server-timing"])}`);
}

console.log(config);
test().then(() => process.exit(), e => {
  console.log(e);
  process.exit(1);
});
