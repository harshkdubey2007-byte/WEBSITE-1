function toggleMenu() {
    let menu = document.getElementById("mobileMenu");
    let btn = document.getElementById("toggleBtn");

    menu.classList.toggle("active");

    // Icon toggle
    if (menu.classList.contains("active")) {
        btn.innerHTML = `<i class="fa-solid fa-xmark fs-3"></i>`;
    } else {
        btn.innerHTML = `<i class="fa-solid fa-bars-staggered fs-3"></i>`;
    }
}

function programMenu() {
    const menu = document.getElementById("promobileMenu");
    const btn = document.getElementById("tobblebutton");

    menu.classList.toggle("active");

    // Optional: icon toggle
    if (menu.classList.contains("active")) {
        btn.innerHTML = `<span>Programs <i class="fa-solid fa-xmark"></i></span>`;
        document.body.style.overflow = "hidden"; // scroll lock
    } else {
        btn.innerHTML = `<span>Programs <i class="fa-solid fa-angles-down"></i></span>`;
        document.body.style.overflow = "";
    }
}

//letest-artical

const el = document.querySelector('.letest-arical');

function adjustTop() {
    const w = window.innerWidth;
    let top;

    if (w <= 320) top = 110;
    else if (w <= 360) top = interpolate(w, 320, 360, 110, 130);
    else if (w <= 400) top = interpolate(w, 360, 400, 135, 150);
    else if (w <= 500) top = interpolate(w, 400, 500, 150, 160);
    else if (w <= 600) top = interpolate(w, 500, 600, 160, 240);
    else top = 100;

    el.style.top = Math.round(top) + "px";
}

/* Linear interpolation helper */
function interpolate(x, x1, x2, y1, y2) {
    return y1 + ((x - x1) * (y2 - y1)) / (x2 - x1);
}

window.addEventListener("resize", adjustTop);
adjustTop();



// banner logic
document.addEventListener("DOMContentLoaded", function () {

    const items = document.querySelectorAll(".banner-right ul li");
    const bannerImage = document.getElementById("bannerImage");
    const placeholder = document.getElementById("imgPlaceholder");
    const dotsContainer = document.getElementById("sliderDots");

    if (!items.length || !bannerImage || !placeholder || !dotsContainer) return;

    let currentIndex = 0;
    let autoPlay;

    /* CREATE DOTS */
    items.forEach((_, i) => {
        const dot = document.createElement("span");
        dot.addEventListener("mouseenter", () => {
            stopAuto();
            currentIndex = i;
            showSlide(i);
            startAuto();
        });
        dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll("span");

    function showSlide(index) {
        if (!items[index]) return;

        items.forEach(item => item.classList.remove("active"));
        dots.forEach(dot => dot.classList.remove("active"));

        items[index].classList.add("active");
        dots[index].classList.add("active");

        const newImg = items[index].dataset.img;
        const newAlt = items[index].dataset.alt || "";

        placeholder.style.display = "block";
        bannerImage.style.display = "none";

        if (newImg) {
            bannerImage.src = newImg;
            bannerImage.alt = newAlt;

            bannerImage.onload = () => {
                placeholder.style.display = "none";
                bannerImage.style.display = "block";
            };

            bannerImage.onerror = () => {
                placeholder.style.background = "#ccc";
            };
        }
    }

    function startAuto() {
        autoPlay = setInterval(() => {
            currentIndex = (currentIndex + 1) % items.length;
            showSlide(currentIndex);
        }, 2000);
    }

    function stopAuto() {
        clearInterval(autoPlay);
    }

    /* Hover Change */
    items.forEach((li, index) => {
        li.addEventListener("mouseenter", () => {
            stopAuto();
            currentIndex = index;
            showSlide(currentIndex);
            startAuto();
        });
    });

    /* Click Open */
    items.forEach((li) => {
        li.addEventListener("click", () => {
            const url = li.dataset.url;
            if (url)  window.location.href = url;
        });
    });

	/* IMAGE CLICK OPEN */
	bannerImage.addEventListener("click", () => {
		const activeItem = items[currentIndex];
		if (!activeItem) return;

		const url = activeItem.dataset.url;
		if (url)  window.location.href = url;
	});

    showSlide(0);
    startAuto();

});







// serrchbox
document.addEventListener("DOMContentLoaded", function () {

    const input = document.getElementById("searchInput");
    const icon = document.querySelector(".search-box i");

    // ✅ SAFETY CHECK
    if (!input || !icon) return;

    input.addEventListener("input", () => {
        icon.style.display = input.value.trim() ? "none" : "block";
    });

});


// category filler

const pills = document.querySelectorAll(".pill-btn");

const categoryfilter = document.querySelectorAll("[data-category]");
function filterPosts(filter) {
    categoryfilter.forEach(card => {
        card.style.display = (card.getAttribute("data-category") === filter) ? "block" : "none";
    });
}

// Page load: show first active category posts
const firstActive = document.querySelector(".pill-btn.active");
if (firstActive) {
    filterPosts(firstActive.getAttribute("data-filter"));
}

// Click event
pills.forEach(pill => {
    pill.addEventListener("click", () => {
        pills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        filterPosts(pill.getAttribute("data-filter"));
    });
});

document.addEventListener("DOMContentLoaded", function () {

    const filterBtns = document.querySelectorAll(".pill-btn");
    const cards = document.querySelectorAll("[data-category]");
    const viewAllBtn = document.getElementById("view-all-btn");

    const basePath = "/blog/";
    const seoSlug = "search-engine-optimization";
    const seoParent = "digital-marketing";

    filterBtns.forEach(btn => {
        btn.addEventListener("click", function () {

            // Active class toggle
            filterBtns.forEach(b => b.classList.remove("active"));
            this.classList.add("active");

            const filter = this.dataset.filter;

            // ✅ View All URL logic
            if (filter === seoSlug) {
                viewAllBtn.href = `${basePath}${seoParent}/${seoSlug}/`;
            } else {
                viewAllBtn.href = `${basePath}${filter}/`;
            }

            // Filter cards
            cards.forEach(card => {
                card.style.display =
                    card.dataset.category === filter ? "block" : "none";
            });

        });
    });

});


//search 

document.addEventListener("DOMContentLoaded", function () {
    const searchInput = document.querySelector(".login-btn input");
    const resultsDiv = document.createElement("div");
    resultsDiv.classList.add("search-dropdown");
    searchInput.parentNode.appendChild(resultsDiv);

    searchInput.addEventListener("keyup", function () {
        const query = this.value.trim();
        if (query.length < 2) {
            resultsDiv.innerHTML = "";
            resultsDiv.style.display = "none";
            return;
        }

        fetch(ajax_obj.ajax_url + "?action=live_search&query=" + encodeURIComponent(query))
            .then(res => res.json())
            .then(data => {
                resultsDiv.innerHTML = "";
                if (data.length === 0) {
                    resultsDiv.innerHTML = "<p>No results found</p>";
                } else {
                    data.forEach(item => {
                        const a = document.createElement("a");
                        a.href = item.url;
                        a.textContent = item.type + ": " + item.title;
                        resultsDiv.appendChild(a);
                    });
                }
                resultsDiv.style.display = "block";
            })
            .catch(err => console.error(err));
    });

    // Hide dropdown when clicking outside
    document.addEventListener("click", function (e) {
        if (!searchInput.parentNode.contains(e.target)) {
            resultsDiv.style.display = "none";
        }
    });
});


// blog title
function applyClampLogicDesktop() {

    document.querySelectorAll(".blog-card").forEach(card => {
        const title = card.querySelector(".blog-title");
        const desc = card.querySelector(".blog-desc");

        if (!title || !desc) return;

        // Reset
        desc.classList.remove("desc-1-line", "desc-2-line", "desc-3-line");

        const style = window.getComputedStyle(title);
        let lineHeight = parseFloat(style.lineHeight);

        if (isNaN(lineHeight)) {
            const clone = title.cloneNode(true);
            clone.style.position = "absolute";
            clone.style.visibility = "hidden";
            clone.style.whiteSpace = "nowrap";
            clone.style.height = "auto";
            document.body.appendChild(clone);

            lineHeight = clone.getBoundingClientRect().height;
            document.body.removeChild(clone);
        }

        const titleHeight = title.getBoundingClientRect().height;
        const lines = Math.round(titleHeight / lineHeight);

        // 🎯 FINAL DESKTOP LOGIC
        if (lines === 1) {
            desc.classList.add("desc-3-line");
        } else if (lines === 2) {
            desc.classList.add("desc-2-line");
        } else {
            desc.classList.add("desc-1-line");
        }
    });
}

window.addEventListener("DOMContentLoaded", applyClampLogicDesktop);
window.addEventListener("resize", applyClampLogicDesktop);


//pagenation

document.addEventListener("DOMContentLoaded", function () {

    if (window.innerWidth > 576) return;

    const wrapper = document.querySelector('.pagination-wrapper');
    if (!wrapper) return;

    const numbers = wrapper.querySelectorAll('.page-numbers:not(.prev):not(.next)');

    if (numbers.length <= 3) return;

    let activeIndex = [...numbers].findIndex(el => el.classList.contains('current'));
    if (activeIndex < 0) activeIndex = 0;

    numbers.forEach(n => n.style.display = 'none');

    for (let i = activeIndex - 1; i <= activeIndex + 1; i++) {
        if (numbers[i]) numbers[i].style.display = 'inline-flex';
    }

});


//prograsse bar single page

document.addEventListener("scroll", function () {
    const progressBar = document.getElementById("read-progress");
    if (!progressBar) return;

    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;

    const progress = (scrollTop / docHeight) * 100;

    progressBar.style.width = progress + "%";
});


// NewsLetter

document.getElementById("newsletter-btn").addEventListener("click", function (e) {
    e.preventDefault();

    let email = document.getElementById("newsletter-email").value.trim();

    if (email === "") {
        reactToast("Please enter email", "error");
        return;
    }

    fetch("/blog/newsletter.php", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "email=" + encodeURIComponent(email)
    })
        .then(res => res.text())
        .then(data => {
            reactToast(data, "success");
            document.getElementById("newsletter-email").value = "";
        })
        .catch(() => {
            reactToast("Server error. Try again.", "error");
        });
});


