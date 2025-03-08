const overlay = document.querySelector('.overlay');
const glassPanel = document.querySelector('.glass-panel');
const gunshot = document.getElementById('gunshot');
const caption = document.querySelector('.caption');
const music = document.getElementById('music');
const playPauseBtn = document.querySelector('.play-pause-btn');
const prevBtn = document.querySelector('.prev-btn');
const nextBtn = document.querySelector('.next-btn');
const progress = document.querySelector('.progress');
const currentTime = document.querySelector('.music-time:first-child');
const totalTime = document.querySelector('.music-time:last-child');
const volumeIcon = document.querySelector('.volume-icon');
const volumeSlider = document.querySelector('.volume-slider');

const playlist = [
    { title: "Đừng Xa Anh Nhé", src: "Đừng Xa Anh Nhé.mp3" },
    { title: "Wrong Times", src: "Wrong Times.mp3" },
    { title: "NắngCóMangEmVề", src: "Nắng có mang em về.mp3" }
];
let currentTrackIndex = 0;

document.onkeydown = function(e) {
    if (
        (e.ctrlKey && e.key.toLowerCase() === "u") || 
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i") ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "j") || 
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") || 
        (e.key.toLowerCase() === "f12") || 
        (e.ctrlKey && e.key.toLowerCase() === "s")
    ) {
        e.preventDefault();
        e.stopPropagation();
        alert("Đừng có lén xem source nha! Dừng lại đi bé!");
        return false;
    }
};


document.addEventListener("contextmenu", function (e) {
    e.preventDefault();
    alert("huhu");
});


(function() {
    let devtoolsOpen = false;
    setInterval(() => {
        if ((window.outerWidth - window.innerWidth > 100) || (window.outerHeight - window.innerHeight > 100)) {
            if (!devtoolsOpen) {
                devtoolsOpen = true;
                alert("Đừng có lén xem source nha! Đóng DevTools lại đi!");

                document.body.style.display = 'none';
                setTimeout(() => {
                    document.body.style.display = 'block';
                }, 100);
            }
        } else {
            devtoolsOpen = false;
        }
    }, 500);
})();


function playSound() {
    gunshot.play();
    overlay.style.opacity = '0';
    glassPanel.style.opacity = '1';
    setTimeout(() => {
        overlay.style.display = 'none';
    }, 500);
    loadTrack(currentTrackIndex);
    music.play();
}

glassPanel.addEventListener('mousemove', (e) => {
    const rect = glassPanel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const mouseX = e.clientX - centerX;
    const mouseY = e.clientY - centerY;

    const maxTilt = 30;
    const tiltX = (mouseY / centerY) * maxTilt;
    const tiltY = -(mouseX / centerX) * maxTilt;

    glassPanel.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
});

glassPanel.addEventListener('mouseleave', () => {
    glassPanel.style.transform = 'rotateX(0deg) rotateY(0deg)';
});

const captions = [
    "Tớ Thích Cậu...",
    "Mãi Luôn Là Cậu....",
    "Still Love You..."
];

let currentCaptionIndex = 0;
let currentText = '';
let isDeleting = false;
let typingSpeed = 100;
let deletingSpeed = 50;
let pauseBetween = 1000;

function type() {
    const currentCaption = captions[currentCaptionIndex];

    if (isDeleting) {
        currentText = currentCaption.substring(0, currentText.length - 1);
    } else {
        currentText = currentCaption.substring(0, currentText.length + 1);
    }

    caption.textContent = currentText;

    let speed = isDeleting ? deletingSpeed : typingSpeed;

    if (!isDeleting && currentText === currentCaption) {
        speed = pauseBetween;
        isDeleting = true;
    } else if (isDeleting && currentText === '') {
        isDeleting = false;
        currentCaptionIndex = (currentCaptionIndex + 1) % captions.length;
        speed = 500;
    }

    setTimeout(type, speed);
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(type, 1000);
    loadTrack(currentTrackIndex);
});

function loadTrack(index) {
    if (index >= 0 && index < playlist.length) {
        currentTrackIndex = index;
        music.src = playlist[currentTrackIndex].src;
        document.querySelector('.music-title').textContent = playlist[currentTrackIndex].title;
        music.play();
        playPauseBtn.textContent = '⏸';
    }
}

function togglePlayPause() {
    if (music.paused) {
        music.play();
        playPauseBtn.textContent = '⏸';
    } else {
        music.pause();
        playPauseBtn.textContent = '▶';
    }
}

function playPrevious() {
    loadTrack((currentTrackIndex - 1 + playlist.length) % playlist.length);
}

function playNext() {
    loadTrack((currentTrackIndex + 1) % playlist.length);
}

music.addEventListener('timeupdate', () => {
    const current = music.currentTime;
    const duration = music.duration || 59;
    const progressPercent = (current / duration) * 100;
    progress.style.width = `${progressPercent}%`;

    const currentMinutes = Math.floor(current / 60);
    const currentSeconds = Math.floor(current % 60);
    currentTime.textContent = `${currentMinutes}:${currentSeconds < 10 ? '0' : ''}${currentSeconds}`;

    const durationMinutes = Math.floor(duration / 60);
    const durationSeconds = Math.floor(duration % 60);
    totalTime.textContent = `${durationMinutes}:${durationSeconds < 10 ? '0' : ''}${durationSeconds}`;
});

music.addEventListener('ended', () => {
    playNext();
});

volumeSlider.addEventListener('input', () => {
    music.volume = volumeSlider.value;
    volumeIcon.src = volumeSlider.value > 0 ? 'speakers.png' : 'mutespeaker.png';
});

function toggleMute() {
    if (music.volume > 0) {
        music.volume = 0;
        volumeIcon.src = 'mutespeaker.png';
    } else {
        music.volume = 1;
        volumeIcon.src = 'speakers.png';
    }
    volumeSlider.value = music.volume;
}

function toggleQR() {
    const qrPopup = document.getElementById('qrPopup');
    if (qrPopup.style.display === 'none' || qrPopup.style.display === '') {
        qrPopup.style.display = 'flex';
    } else {
        qrPopup.style.display = 'none';
    }
}