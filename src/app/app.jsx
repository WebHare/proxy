import React from 'react';
import ReactDOM from 'react-dom';
import injectTapEventPlugin from 'react-tap-event-plugin';
import Main from './main'; // Our custom react component
import "whatwg-fetch";

//Needed for onTouchTap
//Can go away when react 1.0 release
//Check this repo:
//https://github.com/zilverline/react-tap-event-plugin
injectTapEventPlugin();


let state = { clients: [], counter: 0, currentversion: '' };

async function updateUI()
{
  try
  {
//    console.log("Fetch with counter:", state.counter);
    let fetchresult = await fetch(location.origin + "/rpc", //location.origin to work around Request cannot be constructed from a URL that includes credentials
      { method: "post"
      , credentials: 'same-origin'
      , headers:
          { 'Accept': 'application/json'
          , 'Content-Type': 'application/json'
          }
      , body: JSON.stringify(
          { id: 1
          , method: "getGUIState"
          , params: [ state.counter ]
          })
      });

    let jsonresponse = null;

    if (fetchresult.status !== 200)
      throw new Error("Unable to fetch state");

    jsonresponse = await fetchresult.json();

    if (!jsonresponse || jsonresponse.error)
      throw new Error("Got invalid response or error");

    if (state.currentversion && state.currentversion !== jsonresponse.result.currentversion)
      window.location.reload();

    state.clients = jsonresponse.result.clients;
    state.counter = jsonresponse.result.counter;
    state.currentversion = jsonresponse.result.currentversion;

    // Render the main app react component into the app div.
    // For more details see: https://facebook.github.io/react/docs/top-level-api.html#react.render
    ReactDOM.render(<Main clients={state.clients} currentversion={state.currentversion}/>, document.getElementById('app'));

    updateUI();
  }
  catch (e)
  {
    console.log(e.stack);
    setTimeout(updateUI, 2000);
  }
};

updateUI();
