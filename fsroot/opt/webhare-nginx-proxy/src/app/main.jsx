/**
 * In this file, we create a React component
 * which incorporates components providedby material-ui.
 */


import React from 'react';
import RaisedButton from 'material-ui/RaisedButton';
import List from 'material-ui/List';
import ListItem from 'material-ui/List/ListItem';
import Toolbar from 'material-ui/Toolbar';
import ToolbarGroup from 'material-ui/Toolbar/ToolbarGroup';
import ToolbarTitle from 'material-ui/Toolbar/ToolbarTitle';
import {deepOrange500} from 'material-ui/styles/colors';
import getMuiTheme from 'material-ui/styles/getMuiTheme';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import SvgDeleteButton from 'material-ui/svg-icons/action/delete';
import FontIcon from 'material-ui/FontIcon';
import Paper from 'material-ui/Paper';
import Divider from 'material-ui/Divider';
import VPNKey from 'material-ui/svg-icons/communication/vpn-key';
import FlatButton from 'material-ui/FlatButton';
import Dialog from 'material-ui/Dialog';


const styles = {
  container: {
    textAlign: 'center',
    paddingTop: 200,
  },
  leftmenu: {
    width: 300,
    display: "inline-block"
  },
  heading: {
    fontSize: "20px"
  },
  clientregistration: {
    height: "calc(100% - 30px)",
    flex: "1"
  },
  paper: {
    height: "100%",
    display: "flex",
    flexDirection: "column"
  },
  hostslist: {
    overflowY: "scroll",
    flex: "1"
  }
};

const muiTheme = getMuiTheme({
  palette: {
    accent1Color: deepOrange500,
  },
});

class ClientRegistration extends React.Component
{
  constructor(props, context)
  {
    super(props, context);
    this.state = { deleteopen: false };
  }

  gotDeleteClient()
  {
    console.log('gotDeleteClient');
    this.setState({ deleteopen: true });
  };

  gotCloseDeleteClientDialog()
  {
    this.setState({ deleteopen: false });
  };

  async gotDeleteClientSubmit()
  {
    // Delete the client registration. Main update loop will immediately update the app state
    let fetchresult = await fetch(location.origin + "/admin/rpc", //location.origin to work around Request cannot be constructed from a URL that includes credentials
      { method: "post"
      , credentials: 'same-origin'
      , headers:
          { 'Accept': 'application/json'
          , 'Content-Type': 'application/json'
          }
      , body: JSON.stringify(
          { id: 1
          , method: "guiUnregisterProxyClient"
          , params: [ this.props.client.id ]
          })
      });

    this.setState({ deleteopen: false });
  }

  render()
  {
    let hosts = this.props.client.hosts.slice();
    hosts.sort((a,b) => a.servernames[0].localeCompare(b.servernames[0]));

    let dtoptions =
      { year: "numeric"
      , month: "short"
      , day: "numeric"
      , hour: "numeric"
      , minute: "numeric"
      , second: "numeric"
      , timeZone: "Europe/Amsterdam"
      , timeZoneName: "short"
      };

    let lastreg = (new Date(this.props.client.lastregistration)).toLocaleDateString('nl-NL', dtoptions);
    let lastset = this.props.client.lastset ? (new Date(this.props.client.lastset)).toLocaleDateString('nl-NL', dtoptions) : '';

    const deletedialog_actions = [
      <FlatButton
        label="Cancel"
        secondary={true}
        onTouchTap={()=>this.gotCloseDeleteClientDialog()}
      />,
      <FlatButton
        label="Submit"
        primary={true}
        keyboardFocused={true}
        onTouchTap={()=>this.gotDeleteClientSubmit()}
      />,
    ];

    return (
      <div style={styles.clientregistration}>
        <Paper style={styles.paper}>
          <Toolbar>
            <ToolbarGroup float="left" key={0}>
              <ToolbarTitle text={this.props.client.id || 'Example'} />
            </ToolbarGroup>
            <ToolbarGroup float="right" key={1}>
              <FontIcon className="material-icons" tooltip="Delete" onTouchTap={()=>this.gotDeleteClient()}>delete</FontIcon>
            </ToolbarGroup>
          </Toolbar>
          <div style={styles.heading}>Last registration: {lastreg} {lastset ? "set: " + lastset : ""}</div>
          <div style={styles.heading}>Registered server names:</div>
          <List style={styles.hostslist}>
            { hosts.map(host =>
                {
                  let str = host.servernames.join(", ");
                  return <ListItem primaryText={str} key={str} rightIcon={host.with_cert? <VPNKey/> : null} />;
                })}
          </List>
        </Paper>
        <Dialog
          title={"Are you sure you want to delete the registration of '" + this.props.client.id + "' ?"}
          actions={deletedialog_actions}
          modal={false}
          open={this.state.deleteopen}
          onRequestClose={()=>this.gotCloseDeleteClientDialog()}
        >
          If you delete the registrations of an active server, its websites will not function until it re-registers!
        </Dialog>
      </div>
      );
;  };
}

class Main extends React.Component
{
  constructor(props, context)
  {
    super(props, context);
//    this.handleRequestClose = this.handleRequestClose.bind(this);
//    this.handleTouchTap = this.handleTouchTap.bind(this);
    this.selected = "";
    this.state = { selected: this.props.clients.length ? this.props.clients[0].id : "" };

  }

  componentWillReceiveProps(nextprops)
  {
    let sel = nextprops.clients.find(i => i.id === this.state.selected);
    if (!sel)
      this.setState({ selected: nextprops.clients.length ? nextprops.clients[0].id : "" })
  }

  selectClient(id)
  {
    console.log("Select client", id)
    this.setState({ selected: id });
  }

  render()
  {
    let sel = this.props.clients.find(i => i.id === this.state.selected);

/*    const standardActions = (
      <FlatButton
        label="Okey"
        secondary={true}
        onTouchTap={this.handleRequestClose}
      />
    );*/
//    console.log(this);

    let items = [];
//    console.log('render', this.props.clients);

    return (
      <MuiThemeProvider muiTheme={muiTheme}>
        <div style={{height: '100%',display: 'flex', height: '100%',flexDirection:"column"}}>
          <div style={{display: 'flex', height: 'calc(100% - 40px)'}}>
            <div>
              <div style={{fontSize: "20px"}}>Clients</div>
              <List>
                { this.props.clients.map(name => { return <ListItem primaryText={name.id} key={name.id} onTouchTap={ () => this.selectClient(name.id) } />; })}
              </List>
            </div>
            { sel
                ? <ClientRegistration client={sel} />
                : ""
            }
            <Dialog
              title="No active registrations"
              modal={true}
              open={this.props.clients.length === 0}
            >
              There are no servers that have registered with this proxy.
            </Dialog>

          </div>
          <Toolbar>
            <ToolbarTitle text={"Server Version: " + this.props.currentversion} />
          </Toolbar>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default Main;
