const { on } = require('events');
const https = require('https');
const http = require('http');
const { time } = require('console');
const { networkInterfaces } = require('os');

let config =
    { PROXYIP: process.env.PROXYIP
    , CONNECTIP: process.env.CONNECTIP
    , PORT_80: process.env.PORT_80 || "80"
    , PORT_443: process.env.PORT_443 || "443"
    , CONNECTPORT: process.env.CONNECTPORT || "1024"
    , PROXYKEY: process.env.PROXYKEY
    , EXPECTSEENCONNECTIP: process.env.EXPECTSEENCONNECTIP
    };

if (!config.CONNECTIP)
{
  const nets = networkInterfaces();
  for (const name of Object.keys(nets))
    if (nets[name][0].address.startsWith("172.17."))
      config.CONNECTIP = nets[name][0].address;
  if (!config.CONNECTIP)
    throw new Error(`Unable to determine connect IP`)
}

function doRequest(url, options)
{
  let body = options.body;
  delete options.body;

  return new Promise((resolve, reject) =>
  {
    let req = http.request(url, options, res =>
    {
      let responsebody = "";
      res.on("data", chunk => responsebody += chunk);
      res.on("end", () => resolve({ body: responsebody, headers: res.headers, statusCode: res.statusCode }));
    });
    req.on("error", reject);
    if (body)
      req.write(body);
    req.end();
  });
};

let requests = [];

function requestListener(req, res)
{
  console.log(`incoming request: ${req.url}`);
  if (req.url == "/verify/ok")
  {
    res.writeHead(200);
    res.end("ok");
  }
  else if (req.url == "/verify/fail")
  {
    res.writeHead(200);
    res.end("Wrong proxy verification code");
  }
  else if (req.url.startsWith("/verify/"))
  {
    res.writeHead(404);
    res.end("Hello world");
  }
  else
  {
    res.writeHead(200);
    res.end("Hello world: " + req.url);
  }
}

async function test()
{
  // wait 1 minute for server to start
  for (let i = 0; i < 600; ++i)
  {
    console.log(`Waiting for proxy adminhost to respond, try ${i}`);
    try
    {
       await doRequest(`http://${config.PROXYIP}:${config.PORT_80}/`,
          { headers : { host : 'admin.example.com' }
          });
      break;
    }
    catch (e)
    {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  console.log(`Proxy adminhost is active`);

  let response = await doRequest(`http://${config.PROXYIP}:${config.PORT_80}/`,
    { headers : { host : 'admin.example.com' }
    });

  if (response.body != "adminhost\n")
  {
    console.log({ response });
    throw new Error(`Expected 'adminhost\n' as response body`);
  }

  let server = http.createServer(requestListener);
  server.listen(config.CONNECTPORT, config.CONNECTIP);

  response = await doRequest(`http://${config.PROXYIP}:${config.PORT_80}/admin/rpc`,
    { headers : { host : 'admin.example.com'
                , "content-type": 'application/json'
                , 'Authorization': 'Basic ' + Buffer.from(`webhare:${config.PROXYKEY}`).toString('base64')
                }
    , method: 'POST'
    , body: JSON.stringify(
        { method: "registerProxyClient"
        , params:
            [ { id: 'test1'
              , verificationurl: `http://${config.CONNECTIP}:${config.CONNECTPORT}/verify/ok`
              , reverseaddress: `http://${config.CONNECTIP}:${config.CONNECTPORT}`
              , certificates: []
              , proxyid: "testproxy-1"
              , hosts:
                  [ { ports:
                        [ { port: 80 } ]
                    , servernames: [ "test.example.com" ]
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
  for (let i = 0; i < 100; ++i)
  {
    console.log(`wait reload try ${i}`);
    response = await doRequest(`http://${config.PROXYIP}:${config.PORT_80}/normalrequest`,
      { headers : { host : 'test.example.com' }
      , method: 'GET'
      });
    if (response.statusCode != 404)
      break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  if (response.statusCode != 200 || response.body != "Hello world: /normalrequest")
    throw new Error(`Unexpected status return code ${response.statusCode}`);
}

console.log(config);
test().then(() =>process.exit(), e =>
{
  console.log(e);
  process.exit(1);
})
