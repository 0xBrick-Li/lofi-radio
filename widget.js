// widget.js - 桌面小部件的交互逻辑

class LofiWidget {
    constructor() {
        this.isPlaying = false;
        this.currentVolume = 0.3;
        this.init();
    }

    init() {
        // 获取DOM元素
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.closeBtn = document.getElementById('closeBtn');
        this.vinylRecord = document.querySelector('.vinyl-record');

        // 绑定事件
        this.bindEvents();

        // 初始化状态
        this.updatePlayButton();
        this.updateVolumeSlider();

        console.log('Lofi Widget initialized');
    }

    bindEvents() {
        // 播放/暂停按钮
        this.playPauseBtn.addEventListener('click', () => {
            this.togglePlayPause();
        });

        // 音量滑块
        this.volumeSlider.addEventListener('input', (e) => {
            this.setVolume(parseFloat(e.target.value));
        });

        // 关闭按钮
        this.closeBtn.addEventListener('click', () => {
            this.closeApp();
        });

        // 监听来自主进程的状态变化
        if (window.lofiWidget) {
            window.lofiWidget.onPlayStateChange((isPlaying) => {
                this.isPlaying = isPlaying;
                this.updatePlayButton();
                this.updateVinylAnimation();
            });

            window.lofiWidget.onVolumeChange((volume) => {
                this.currentVolume = volume;
                this.updateVolumeSlider();
            });
        }
    }

    togglePlayPause() {
        if (window.lofiWidget) {
            window.lofiWidget.togglePlayPause();
            // 立即更新UI状态（乐观更新）
            this.isPlaying = !this.isPlaying;
            this.updatePlayButton();
            this.updateVinylAnimation();
        }
    }

    setVolume(volume) {
        this.currentVolume = volume;
        if (window.lofiWidget) {
            window.lofiWidget.setVolume(volume);
        }
    }

    closeApp() {
        if (window.lofiWidget) {
            window.lofiWidget.closeApp();
        }
    }

    updatePlayButton() {
        const playIcon = this.playPauseBtn.querySelector('.play-icon');
        const pauseIcon = this.playPauseBtn.querySelector('.pause-icon');

        if (this.isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'block';
        } else {
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        }
    }

    updateVolumeSlider() {
        this.volumeSlider.value = this.currentVolume;
    }

    updateVinylAnimation() {
        if (this.isPlaying) {
            this.vinylRecord.classList.add('playing');
        } else {
            this.vinylRecord.classList.remove('playing');
        }
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new LofiWidget();
});

// 全局错误处理
window.addEventListener('error', (e) => {
    console.error('Widget error:', e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error('Widget unhandled rejection:', e.reason);
});