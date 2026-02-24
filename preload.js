const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lofiWidget', {
  togglePlayPause: () => {
    ipcRenderer.send('toggle-play-pause');
  },

  setVolume: (volume) => {
    ipcRenderer.send('set-volume', volume);
  },

  closeApp: () => {
    ipcRenderer.send('close-app');
  },

  onPlayStateChange: (callback) => {
    ipcRenderer.on('play-state-changed', (event, isPlaying) => {
      callback(isPlaying);
    });
  },

  onVolumeChange: (callback) => {
    ipcRenderer.on('volume-changed', (event, volume) => {
      callback(volume);
    });
  },

  getStations: () => ipcRenderer.send('get-stations'),
  
  changeStation: (index) => ipcRenderer.send('change-station', index),
  
  onStationsList: (callback) => {
    ipcRenderer.on('stations-list', (event, stations) => callback(stations));
  },
  
  onStationChanged: (callback) => {
    ipcRenderer.on('station-changed', (event, station, index) => callback(station, index));
  }
});

contextBridge.exposeInMainWorld('electronAPI', {
  closeWindow: () => {
    ipcRenderer.send('close-app');
  },

  toggleMiniMode: () => {
    ipcRenderer.send('toggle-mini-mode');
  }
});

contextBridge.exposeInMainWorld('audioPlayer', {
  onPlay: (callback) => ipcRenderer.on('audio-command-play', (event) => callback()),
  onPause: (callback) => ipcRenderer.on('audio-command-pause', (event) => callback()),
  onSetVolume: (callback) => ipcRenderer.on('audio-command-volume', (event, volume) => callback(volume)),
  onChangeStation: (callback) => ipcRenderer.on('audio-command-station', (event, url, type) => callback(url, type)),
  sendState: (state) => ipcRenderer.send('audio-state-update', state),
  sendError: (error) => ipcRenderer.send('audio-error', error)
});
