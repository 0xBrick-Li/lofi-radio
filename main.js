const { app, BrowserWindow, Tray, Menu, globalShortcut } = require('electron');
const path = require('path');

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 禁用 Electron 的安全警告（仅用于开发）
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// 保持对窗口对象的全局引用，如果不这么做的话，当 JavaScript 对象被
// 垃圾回收时，window 对象将会自动的关闭
let mainWindow; // 桌面小部件窗口
let audioWindow; // 隐藏的音频窗口
let tray;

function createWindow() {
  try {
    // 创建浏览器窗口 - 桌面小部件样式
    mainWindow = new BrowserWindow({
      width: 300,
      height: 150,
      show: true, // 显示窗口（不再隐形）
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: true,
        allowRunningInsecureContent: false
      },
      // 桌面小部件配置
      frame: false, // 无边框
      transparent: true, // 透明背景
      alwaysOnTop: true, // 置顶显示
      skipTaskbar: false, // 显示在任务栏
      resizable: false, // 不可调整大小
      minimizable: false, // 不可最小化
      maximizable: false, // 不可最大化
      closable: true, // 可关闭
      // 毛玻璃效果 (Windows 10+)
      vibrancy: 'appearance-based', // 或 'light', 'dark'
      // 圆角效果
      roundedCorners: true,
      // 阴影
      hasShadow: true
    });

    console.log('Widget window created successfully');
  } catch (e) {
    console.error('Failed to create widget window:', e);
    app.quit();
    return;
  }

  // 加载桌面小部件UI
  mainWindow.loadFile('index.html');

  // 设置窗口位置到屏幕右下角
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  mainWindow.setPosition(width - 320, height - 170); // 留出一些边距

  // 监听来自UI的IPC消息
  const { ipcMain } = require('electron');

  ipcMain.on('toggle-play-pause', () => {
    if (audioWindow && !audioWindow.isDestroyed()) {
      audioWindow.webContents.executeJavaScript(`
        const videos = document.querySelectorAll('video');
        if (videos.length > 0) {
          const video = videos[0];
          if (video.paused) {
            video.play().then(() => {
              console.log('Audio: Play triggered from widget');
            }).catch(e => console.log('Audio: Play failed:', e));
          } else {
            video.pause();
            console.log('Audio: Pause triggered from widget');
          }
        }
      `).catch(err => console.error('Failed to toggle audio:', err));
    }
  });

  ipcMain.on('set-volume', (event, volume) => {
    if (audioWindow && !audioWindow.isDestroyed()) {
      audioWindow.webContents.executeJavaScript(`
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.volume = ${volume};
        });
        console.log('Audio: Volume set to', ${volume});
      `).catch(err => console.error('Failed to set volume:', err));
    }
  });

  ipcMain.on('close-app', () => {
    app.quit();
  });

  // 处理来自音频窗口的状态更新
  ipcMain.on('audio-play-state-changed', (event, isPlaying) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('play-state-changed', isPlaying);
    }
  });

  ipcMain.on('audio-volume-changed', (event, volume) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('volume-changed', volume);
    }
  });

  // 当窗口被关闭，这个事件会被触发
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建隐藏的音频窗口
function createAudioWindow() {
  try {
    audioWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      show: false, // 完全隐藏
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      skipTaskbar: true
    });

    // 加载 Bilibili 直播间
    audioWindow.loadURL('https://live.bilibili.com/27519423?live_from=84001&spm_id_from=333.337.0.0');

  // 当页面加载完成后，注入 JavaScript 代码
  audioWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      audioWindow.webContents.executeJavaScript(`
        // 取消视频静音并设置音量
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
          video.muted = false;
          video.volume = 0.3; // 默认30%音量

          // 监听播放状态变化
          video.addEventListener('play', () => {
            window.postMessage({ type: 'playStateChanged', isPlaying: true }, '*');
          });

          video.addEventListener('pause', () => {
            window.postMessage({ type: 'playStateChanged', isPlaying: false }, '*');
          });

          video.addEventListener('volumechange', () => {
            window.postMessage({ type: 'volumeChanged', volume: video.volume }, '*');
          });

          console.log('Audio window: video unmuted and volume set');
        });

        // 尝试自动播放
        if (videos.length > 0) {
          videos[0].play().catch(e => {
            console.log('Auto-play failed:', e);
          });
        }

        console.log('Audio window: Page loaded');
      `).catch(err => {
        console.error('Audio window: Failed to execute JavaScript:', err);
      });
    }, 3000);
  });

  // 监听来自音频窗口的消息
  audioWindow.webContents.on('console-message', (event, level, message) => {
    if (message.includes('playStateChanged') || message.includes('volumeChanged')) {
      // 这里可以处理状态变化的通知
      console.log('Audio status:', message);
    }
  });

    console.log('Audio window created successfully');
  } catch (e) {
    console.error('Failed to create audio window:', e);
  }
}

// 创建系统托盘
function createTray() {
  try {
    // 在 Windows 上简化托盘图标创建，避免复杂的图标生成
    // 使用一个空的 Buffer 或者跳过图标创建
    tray = new Tray(Buffer.alloc(0)); // 创建一个空的托盘图标

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '播放/暂停 (Alt+Q)',
      click: () => {
        // 通过IPC触发播放/暂停
        const { ipcMain } = require('electron');
        ipcMain.emit('toggle-play-pause');
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.quit();
      }
    }
  ]);

    tray.setToolTip('Lofi Radio Player - Alt+Q 播放/暂停');
    tray.setContextMenu(contextMenu);

    console.log('Tray created successfully');
  } catch (e) {
    console.log('Tray creation failed, continuing without tray:', e.message);
    // 如果托盘创建失败，继续运行应用（只是没有托盘功能）
  }
}

// 注册全局快捷键
function registerGlobalShortcut() {
  // 注册 Alt+Q 快捷键
  const success = globalShortcut.register('Alt+Q', () => {
    console.log('Alt+Q pressed - toggling play/pause');
    // 通过IPC触发播放/暂停
    const { ipcMain } = require('electron');
    ipcMain.emit('toggle-play-pause');
  });

  if (success) {
    console.log('Global shortcut Alt+Q registered successfully');
  } else {
    console.log('Failed to register global shortcut Alt+Q');
  }
}

// Electron 会在初始化后并准备创建浏览器窗口时，调用这个函数
app.whenReady().then(() => {
  console.log('App is ready, creating windows...');
  createAudioWindow(); // 先创建音频窗口
  createWindow(); // 再创建UI窗口
  createTray();
  registerGlobalShortcut();

  app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) {
      createAudioWindow();
      createWindow();
    }
  });
}).catch((error) => {
  console.error('Failed to initialize app:', error);
  app.quit();
});

// 当全部窗口关闭时退出
app.on('window-all-closed', () => {
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 在应用退出前取消注册快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});