const demo = document.querySelector(".demo");
const pause = document.querySelector("#pause");
const replay = document.querySelector("#replay");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");

function setPaused(paused) {
  demo.classList.toggle("paused", paused);
  pause.textContent = paused ? "Tiếp tục" : "Tạm dừng";
}

function followMotionPreference() {
  demo.classList.remove("allow-motion");
  setPaused(reduce.matches);
}

pause.addEventListener("click", () => {
  demo.classList.add("allow-motion");
  setPaused(!demo.classList.contains("paused"));
});

replay.addEventListener("click", () => {
  demo.classList.add("allow-motion", "restarting");
  void demo.offsetWidth;
  demo.classList.remove("restarting");
  setPaused(false);
});

reduce.addEventListener("change", followMotionPreference);
followMotionPreference();
