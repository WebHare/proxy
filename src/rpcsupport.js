"use strict";

function sendReply(res, error, result, id)
{
  let message = { id: id };
  if (error)
    message.error = error;
  else
    message.result = result;

  res.writeHead(200,
    { "Cache-Control":  "no-cache, no-store, must-revalidate"
    , "Pragma":         "no-cache"
    , "Expires":        "0"
    });

  res.end(JSON.stringify(message));
}

exports.sendReply = sendReply;