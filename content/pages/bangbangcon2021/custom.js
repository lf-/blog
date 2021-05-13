slideshow.on('showSlide', s => {
    if (s.properties['video-fullscreen']) {
        const el = document.createElement("video");
        el.classList.add('video-fullscreen');
        el.src = s.properties['video-fullscreen'];
        el.controls = false;
        document.body.prepend(el);
        el.play();
    } else {
        document.querySelectorAll('.video-fullscreen').forEach(el => el.parentElement.removeChild(el));
    }
});
