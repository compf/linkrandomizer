import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { UrlRandomizerHandler } from './handlers/website-handler.js';
import { loadWebsites } from './data/websites-data.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let controlWindow: BrowserWindow|undefined=undefined
const initIPC=()=>{
    const sendToBackend={
        ...UrlRandomizerHandler.sendToBackend
    }
    const invokeFromBackend={
        ...UrlRandomizerHandler.invokeFromBackend
    }

    console.log("sendToBackend keys:", Object.keys(sendToBackend));
    console.log("invokeFromBackend keys:", Object.keys(invokeFromBackend));

    for(const key in sendToBackend){
        const method=sendToBackend[key as keyof typeof sendToBackend];
        ipcMain.on(key, async (event, args) => {
            console.log("ipcMain on",key,args)
            // call the handler and, if it returns a value, send it back to the same renderer
            try{
                const result = (method as any)(args, event);
                if(result !== undefined){
                    event.sender.send('loadProject', result);
                }
            }catch(err){
                console.error("error in handler for", key, err);
            }
        })
    }

    for(const key in invokeFromBackend){
        const method=invokeFromBackend[key as keyof typeof invokeFromBackend];
        console.log("Registering invoke handler:", key, typeof method);
        ipcMain.handle(key, async (event, args) => {
            try{
                return await (method as any)(args);
            }catch(err){
                console.error("error in handler for", key, err);
                throw err;
            }
        })
    }
}
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    
  });
  controlWindow=win;

  initIPC();
  console.log("IPC initialized");
  
  const indexPath = path.join(__dirname, '..', '..', 'frontend', 'dist',"frontend" ,"browser",'index.html');
  win.loadFile(indexPath);
  console.log("Loading frontend from:", indexPath);

  // After renderer finishes loading, fetch some diagnostics and log them to the terminal
  
}

const createMenu = () => {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Save Websites',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            try {
              await UrlRandomizerHandler.invokeFromBackend.saveWebsites();
              console.log('Websites saved');
            } catch (error) {
              console.error('Error saving websites:', error);
            }
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};

export const sendToControlWindow=(channel:string, data:any)=>{
  const win=controlWindow!!;
    win.webContents.send(channel, data)
  };


app.whenReady().then(()=>{
    loadWebsites();
    createWindow();
    createMenu();
 
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
