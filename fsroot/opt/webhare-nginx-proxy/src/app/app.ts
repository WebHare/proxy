import { renderAdminUI, type GUIClient } from "./main.ts";
import "./main.css";

type GUIState = {
  clients: GUIClient[];
  counter: number;
  currentversion: string;
};

type RPCResponse<T> = {
  result?: T;
  error?: { message?: string };
};

const appRoot = document.getElementById("app");
if (!appRoot)
  throw new Error("Missing admin application root");
const app: HTMLElement = appRoot;
const proxyHostname = window.location.hostname;
document.title = `${proxyHostname.split(".")[0]} - Proxy Control`;

let state: GUIState = { clients: [], counter: 0, currentversion: "" };
let selectedClientId = "";
let pendingRemovalId = "";

function setConnectionStatus(message: string, isError: boolean) {
  const badge = app.querySelector(".connection-state");
  if (!badge)
    return;

  badge.classList.toggle("is-error", isError);
  const dot = document.createElement("span");
  dot.className = "connection-dot";
  const label = document.createElement("span");
  label.textContent = message;
  badge.replaceChildren(dot, label);
}

function render(loading = false) {
  selectedClientId = renderAdminUI(app, state.clients, state.currentversion, selectedClientId, loading, proxyHostname);
}

async function removeClient(clientId: string, confirmButton: HTMLButtonElement) {
  confirmButton.disabled = true;
  confirmButton.textContent = "Removing...";
  try {
    const response = await fetch(`${location.origin}/admin/rpc`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: 1, method: "guiUnregisterProxyClient", params: [clientId] })
    });

    if (!response.ok)
      throw new Error(`Request failed (${response.status})`);

    const result = await response.json() as RPCResponse<{ success?: boolean }>;
    if (result.error || !result.result?.success)
      throw new Error(result.error?.message ?? "The registration could not be removed");

    app.querySelector<HTMLDialogElement>("[data-role='remove-dialog']")?.close();
    setConnectionStatus("Removal requested", false);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setConnectionStatus(message, true);
    confirmButton.disabled = false;
    confirmButton.textContent = "Remove registration";
  }
}

app.addEventListener("click", event => {
  if (!(event.target instanceof Element))
    return;

  const button = event.target.closest<HTMLButtonElement>("button[data-action]");
  if (!button)
    return;

  if (button.dataset.action === "select-client" && button.dataset.clientId) {
    selectedClientId = button.dataset.clientId;
    render();
  } else if (button.dataset.action === "remove-client") {
    pendingRemovalId = selectedClientId;
    app.querySelector<HTMLDialogElement>("[data-role='remove-dialog']")?.showModal();
  } else if (button.dataset.action === "confirm-remove" && pendingRemovalId) {
    void removeClient(pendingRemovalId, button);
  }
});

async function updateUI() {
  render(true);

  while (true) {
    try {
      const response = await fetch(`${location.origin}/admin/rpc`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ id: 1, method: "getGUIState", params: [state.counter] })
      });

      if (!response.ok)
        throw new Error(`Unable to fetch state (${response.status})`);

      const rpcResponse = await response.json() as RPCResponse<GUIState>;
      if (!rpcResponse.result || rpcResponse.error)
        throw new Error(rpcResponse.error?.message ?? "Received an invalid state response");

      const nextState = rpcResponse.result;
      if (state.currentversion && state.currentversion !== nextState.currentversion) {
        window.location.reload();
        return;
      }

      state = nextState;
      render();
    } catch (error) {
      console.error("Unable to update proxy admin state", error);
      setConnectionStatus("Reconnecting", true);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

void updateUI();
