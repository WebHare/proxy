export type GUIClient = {
  id: string;
  lastregistration: number;
  lastset: string;
  hosts: Array<{
    servernames: string[];
  }>;
};

function makeElement<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className)
    element.className = className;
  if (text !== undefined)
    element.textContent = text;
  return element;
}

function formatDate(value: string | number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    return "Not available";

  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Amsterdam",
    timeZoneName: "short"
  }).format(date);
}

function renderClientList(clients: GUIClient[], selectedId: string) {
  const list = makeElement("nav", "client-list");
  list.setAttribute("aria-label", "Registered clients");

  for (const client of clients) {
    const button = makeElement("button", "client-item");
    button.type = "button";
    button.dataset.action = "select-client";
    button.dataset.clientId = client.id;
    button.setAttribute("aria-pressed", String(client.id === selectedId));

    const marker = makeElement("span", "client-item-marker");
    marker.setAttribute("aria-hidden", "true");
    button.append(marker, makeElement("span", "client-item-title", client.id));
    button.append(makeElement("span", "client-item-meta", `${client.hosts.length} ${client.hosts.length === 1 ? "host" : "hosts"}`));
    list.append(button);
  }

  if (!clients.length)
    list.append(makeElement("p", "sidebar-empty", "No clients registered"));

  return list;
}

function renderHosts(client: GUIClient) {
  const section = makeElement("section", "hosts-section");
  const heading = makeElement("div", "section-heading");
  heading.append(makeElement("h2", undefined, "Hosted domains"));
  heading.append(makeElement("span", "count-label", String(client.hosts.length).padStart(2, "0")));
  section.append(heading);

  if (!client.hosts.length) {
    section.append(makeElement("p", "empty-note", "No domains are configured for this client."));
    return section;
  }

  const list = makeElement("ul", "host-list");
  const hosts = [...client.hosts].sort((left, right) => (left.servernames[0] ?? "").localeCompare(right.servernames[0] ?? ""));

  for (const host of hosts) {
    const item = makeElement("li", "host-row");
    const names = makeElement("div", "host-names");
    for (const name of host.servernames)
      names.append(makeElement("span", "host-name", name));

    item.append(names);
    list.append(item);
  }

  section.append(list);
  return section;
}

function renderDetails(client: GUIClient) {
  const details = makeElement("section", "registration");
  details.setAttribute("aria-labelledby", "registration-title");

  const heading = makeElement("header", "registration-header");
  const titleBlock = makeElement("div", "title-block");
  titleBlock.append(makeElement("p", "eyebrow", "CLIENT REGISTRATION"));
  const title = makeElement("h1", undefined, client.id);
  title.id = "registration-title";
  titleBlock.append(title);
  const removeButton = makeElement("button", "remove-button", "Remove registration");
  removeButton.type = "button";
  removeButton.dataset.action = "remove-client";
  heading.append(titleBlock, removeButton);
  details.append(heading);

  const facts = makeElement("dl", "registration-facts");
  for (const [label, value] of [
    ["Last registration", formatDate(client.lastregistration)],
    ["Configuration updated", client.lastset ? formatDate(client.lastset) : "Not available"],
    ["Hosted domains", String(client.hosts.length)]
  ]) {
    const fact = makeElement("div", "fact");
    fact.append(makeElement("dt", undefined, label), makeElement("dd", undefined, value));
    facts.append(fact);
  }
  details.append(facts, renderHosts(client));

  const dialog = makeElement("dialog", "confirm-dialog");
  dialog.dataset.role = "remove-dialog";
  const form = makeElement("form", "dialog-content");
  form.method = "dialog";
  form.append(makeElement("p", "eyebrow", "REMOVE CLIENT"));
  form.append(makeElement("h2", undefined, "Remove this registration?"));
  form.append(makeElement("p", "dialog-copy", `Removing ${client.id} will stop this proxy from serving its configured websites until the client registers again.`));
  const actions = makeElement("div", "dialog-actions");
  const cancel = makeElement("button", "button-secondary", "Cancel");
  cancel.type = "submit";
  cancel.value = "cancel";
  const confirm = makeElement("button", "button-danger", "Remove registration");
  confirm.type = "button";
  confirm.dataset.action = "confirm-remove";
  actions.append(cancel, confirm);
  form.append(actions);
  dialog.append(form);
  details.append(dialog);
  return details;
}

export function renderAdminUI(root: HTMLElement, clients: GUIClient[], currentversion: string, selectedId: string, loading: boolean, proxyHostname: string) {
  const selectedClient = clients.find(client => client.id === selectedId) ?? clients[0];
  const nextSelectedId = selectedClient?.id ?? "";
  const shell = makeElement("div", "admin-shell");
  const sidebar = makeElement("aside", "sidebar");

  const brand = makeElement("div", "brand");
  const brandLogo = makeElement("img", "brand-logo");
  brandLogo.src = "https://cms0.webhare.com/.publisher/sd/tollium/webinterface/img/webhare-white.svg";
  brandLogo.alt = "WebHare";
  brand.append(brandLogo, makeElement("span", "brand-name", "WebHare Proxy"));
  sidebar.append(brand);

  const clientHeading = makeElement("div", "client-heading");
  clientHeading.append(makeElement("h2", undefined, "Clients"));
  clientHeading.append(makeElement("span", "count-label", String(clients.length).padStart(2, "0")));
  sidebar.append(clientHeading, renderClientList(clients, nextSelectedId));

  const workspace = makeElement("main", "workspace");
  const connection = makeElement("span", "connection-state");
  connection.append(makeElement("span", "connection-dot"), makeElement("span", undefined, "Connected"));

  const content = makeElement("div", "content");
  const pageHeading = makeElement("div", "page-heading");
  pageHeading.append(makeElement("p", "eyebrow", "CONFIGURATION"));
  pageHeading.append(makeElement("h1", undefined, "Active registrations"));
  pageHeading.append(makeElement("p", "page-summary", "Clients and domains currently routed through this proxy."));
  const proxyIdentity = makeElement("div", "proxy-identity");
  proxyIdentity.append(makeElement("span", "proxy-identity-label", "PROXY HOST"));
  proxyIdentity.append(makeElement("span", "proxy-identity-name", proxyHostname));
  pageHeading.append(proxyIdentity);
  content.append(pageHeading);

  if (selectedClient) {
    content.append(renderDetails(selectedClient));
  } else {
    const empty = makeElement("section", `empty-state${loading ? " is-loading" : ""}`);
    empty.append(makeElement("span", "empty-index", loading ? "..." : "00"));
    empty.append(makeElement("h2", undefined, loading ? "Connecting to proxy" : "No active registrations"));
    empty.append(makeElement("p", undefined, loading ? "Waiting for the configuration service." : "Registered clients will appear here when they connect."));
    content.append(empty);
  }

  const footer = makeElement("footer", "statusbar");
  footer.append(makeElement("span", "status-label", "PROXY VERSION"));
  footer.append(makeElement("span", "version-value", currentversion || "Loading"));
  footer.append(makeElement("span", "status-spacer"));
  footer.append(makeElement("span", "status-label", `${clients.length} ${clients.length === 1 ? "CLIENT" : "CLIENTS"}`));
  footer.append(connection);
  workspace.append(content, footer);
  shell.append(sidebar, workspace);
  root.replaceChildren(shell);
  return nextSelectedId;
}
