/* Alpine Ascents — front-end interactions
 * Written as small, readable modules so the page stays easy to maintain.
 */
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const onReady = (callback) => {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", callback, { once: true });
  } else {
    callback();
  }
};

onReady(() => {
  // ------------------------------------------------------------
  // Bootstrap helpers
  // ------------------------------------------------------------
  const navElement = $("#mainNav");
  const navMenu = $("#navContent");
  const hasBootstrap = typeof bootstrap !== "undefined";

  // The CDN is normally available, but this small fallback keeps
  // the mobile menu usable if Bootstrap's JS is unavailable.
  const closeMobileMenu = () => {
    if (!navMenu) return;
    if (hasBootstrap) {
      bootstrap.Collapse.getOrCreateInstance(navMenu, { toggle: false }).hide();
      return;
    }
    navMenu.classList.remove("show");
    $(".navbar-toggler")?.setAttribute("aria-expanded", "false");
  };

  if (navMenu && !hasBootstrap) {
    $(".navbar-toggler")?.addEventListener("click", () => {
      const open = navMenu.classList.toggle("show");
      $(".navbar-toggler")?.setAttribute("aria-expanded", String(open));
    });
  }

  // ------------------------------------------------------------
  // Preloader
  // ------------------------------------------------------------
  const preloader = $("#preloader");
  window.addEventListener("load", () => {
    window.setTimeout(() => preloader?.classList.add("hide"), 250);
  });

  // ------------------------------------------------------------
  // Sticky / scrolling navbar
  // ------------------------------------------------------------
  const updateNavbar = () => {
    navElement?.classList.toggle("scrolled", window.scrollY > 30);
  };
  window.addEventListener("scroll", updateNavbar, { passive: true });
  updateNavbar();

  // Close the mobile menu after choosing a normal navigation item.
  $$("#navContent .nav-link:not(.dropdown-toggle), #navContent .dropdown-item").forEach((link) => {
    link.addEventListener("click", closeMobileMenu);
  });

  // ------------------------------------------------------------
  // Demo visitor counter
  // ------------------------------------------------------------
  let visitorCount = Number(localStorage.getItem("alpineVisitors")) || 1248;
  const sessionKey = "alpineVisitorSession";

  if (!sessionStorage.getItem(sessionKey)) {
    visitorCount += 1;
    localStorage.setItem("alpineVisitors", String(visitorCount));
    sessionStorage.setItem(sessionKey, "1");
  }

  $("#visitorCount") && ($("#visitorCount").textContent = visitorCount.toLocaleString());
  $("#visitorCountMobile") && ($("#visitorCountMobile").textContent = visitorCount.toLocaleString());

  // ------------------------------------------------------------
  // Reveal-on-scroll animations
  // ------------------------------------------------------------
  const revealItems = $$(".reveal");
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    revealItems.forEach((item) => revealObserver.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("visible"));
  }

  // ------------------------------------------------------------
  // Animated statistics
  // ------------------------------------------------------------
  const counters = $$('[data-counter]');
  const animateCounter = (element) => {
    const target = Number(element.dataset.counter) || 0;
    const duration = 1200;
    let startTime = null;

    const step = (time) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = Math.floor(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  if ("IntersectionObserver" in window) {
    const counterObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target);
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.6 });
    counters.forEach((counter) => counterObserver.observe(counter));
  } else {
    counters.forEach((counter) => {
      counter.textContent = Number(counter.dataset.counter).toLocaleString();
    });
  }

  // ------------------------------------------------------------
  // Information modal
  // ------------------------------------------------------------
  const infoModalElement = $("#infoModal");
  const infoModal = hasBootstrap && infoModalElement
    ? bootstrap.Modal.getOrCreateInstance(infoModalElement)
    : null;

  $$(".modal-trigger").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest(".topic-card");
      if (!card) return;

      $("#infoModalLabel") && ($("#infoModalLabel").textContent = card.dataset.modalTitle || "Information");
      $("#infoModalBody") && ($("#infoModalBody").textContent = card.dataset.modalBody || "");
      infoModal?.show();
    });
  });

  // ------------------------------------------------------------
  // JSON data with local-file fallbacks
  // ------------------------------------------------------------
  const loadJson = async (url, fallback) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.info(`Using local fallback for ${url}.`, error);
      return fallback;
    }
  };

  const fallbackRecords = [
    { rank: 1, record: "Highest mountain above sea level", value: "8,848.86 m", subject: "Mount Everest", location: "Nepal / China" },
    { rank: 2, record: "Second-highest mountain", value: "8,611 m", subject: "K2", location: "Pakistan / China" },
    { rank: 3, record: "Highest peak in Pakistan", value: "8,611 m", subject: "K2", location: "Gilgit-Baltistan" }
  ];

  loadJson("data/records.json", fallbackRecords).then((records) => {
    const tableBody = $("#recordsBody");
    if (!tableBody) return;
    tableBody.innerHTML = records.map((record) => `
      <tr>
        <td>${record.rank}</td>
        <td>${record.record}</td>
        <td><strong>${record.value}</strong></td>
        <td>${record.subject}</td>
        <td>${record.location}</td>
      </tr>`).join("");
  });

  // ------------------------------------------------------------
  // Organization map
  // ------------------------------------------------------------
  const fallbackOrganizations = [
    { name: "Alpine Club of Pakistan", country: "Pakistan", location: "Islamabad, Pakistan", lat: 33.6844, lng: 73.0479, description: "Sample educational organization listing." },
    { name: "Alpine Club of Canada", country: "Canada", location: "Canmore, Alberta, Canada", lat: 51.089, lng: -115.359, description: "Sample global club listing." },
    { name: "British Mountaineering Council", country: "United Kingdom", location: "Manchester, UK", lat: 53.4808, lng: -2.2426, description: "Sample organization listing." }
  ];

  let map = null;
  let markers = [];
  let currentOrganizations = [];

  const activateOrganization = (index) => {
    $$(".org-card").forEach((card, cardIndex) => {
      card.classList.toggle("active", cardIndex === index);
    });

    const organization = currentOrganizations[index];
    if (!organization || !map) return;

    map.setView([organization.lat, organization.lng], 6, { animate: true });
    markers[index]?.openPopup();
  };

  const initializeMap = (organizations) => {
    const mapElement = $("#map");
    if (!mapElement) return;

    if (typeof L === "undefined") {
      mapElement.innerHTML = '<div class="d-flex h-100 align-items-center justify-content-center text-white-50 p-4 text-center">Interactive map library could not load. Organization cards remain available.</div>';
      return;
    }

    map = L.map(mapElement, { scrollWheelZoom: false }).setView([32, 35], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    markers = organizations.map((organization, index) => {
      const marker = L.marker([organization.lat, organization.lng])
        .addTo(map)
        .bindPopup(`<strong>${organization.name}</strong><br>${organization.location}<br><small>${organization.description}</small>`);
      marker.on("click", () => activateOrganization(index));
      return marker;
    });
  };

  loadJson("data/organizations.json", fallbackOrganizations).then((organizations) => {
    currentOrganizations = organizations;
    const container = $("#orgCards");
    if (!container) return;

    container.innerHTML = organizations.map((organization, index) => `
      <article class="org-card reveal visible" data-index="${index}">
        <h3>${organization.name}</h3>
        <p>${organization.description}</p>
        <div class="org-meta">${organization.location} · ${organization.country}</div>
      </article>`).join("");

    $$(".org-card").forEach((card) => {
      card.addEventListener("click", () => activateOrganization(Number(card.dataset.index)));
    });

    initializeMap(organizations);
  });

  // Find-my-location button — guarded so a missing element can never
  // stop the rest of the site's JavaScript from running.
  const locateButton = $("#locateBtn");
  locateButton?.addEventListener("click", () => {
    const status = $("#locationStatus");
    if (!status) return;

    if (!navigator.geolocation) {
      status.textContent = "Geolocation is not supported by this browser.";
      return;
    }

    status.textContent = "Requesting your location…";
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        status.textContent = `Location detected: ${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;

        if (map) {
          L.circleMarker([latitude, longitude], {
            radius: 8,
            color: "#20a9e8",
            fillColor: "#20a9e8",
            fillOpacity: 0.8
          }).addTo(map).bindPopup("Your approximate location").openPopup();
          map.setView([latitude, longitude], 7);
        }
      },
      () => {
        status.textContent = "Location unavailable — permission denied or unavailable.";
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  });

  // ------------------------------------------------------------
  // Success stories
  // ------------------------------------------------------------
  const fallbackStories = [
    { title: "Across the Karakoram", location: "Gilgit-Baltistan, Pakistan", date: "2026", image: "images/gallery/high-mountain-camp.png", summary: "A fictional educational expedition story about preparation and conservative decisions." },
    { title: "First Light on the Ridge", location: "Alpine Valley", date: "2026", image: "images/gallery/sunrise-expedition.png", summary: "A fictional story about dawn starts, pacing and changing conditions." }
  ];

  loadJson("data/stories.json", fallbackStories).then((stories) => {
    const grid = $("#storyGrid");
    if (!grid) return;

    grid.innerHTML = stories.map((story, index) => `
      <div class="col-12 col-md-6 col-lg-4 reveal visible">
        <article class="story-card">
          <img src="${story.image}" alt="${story.title}">
          <div class="story-card-body">
            <span>${story.location} · ${story.date}</span>
            <h3>${story.title}</h3>
            <p>${story.summary}</p>
            <button type="button" class="story-more" data-story="${index}">
              Read story <i class="bi bi-arrow-right" aria-hidden="true"></i>
            </button>
          </div>
        </article>
      </div>`).join("");

    $$(".story-more").forEach((button) => {
      button.addEventListener("click", () => {
        const story = stories[Number(button.dataset.story)];
        if (!story) return;
        $("#infoModalLabel") && ($("#infoModalLabel").textContent = story.title);
        $("#infoModalBody") && ($("#infoModalBody").textContent = story.body || story.summary);
        infoModal?.show();
      });
    });
  });

  // ------------------------------------------------------------
  // Gallery filters + lightbox
  // ------------------------------------------------------------
  const galleryModalElement = $("#galleryModal");
  const galleryModal = hasBootstrap && galleryModalElement
    ? bootstrap.Modal.getOrCreateInstance(galleryModalElement)
    : null;

  $$(".filter-btn").forEach((button) => {
    button.addEventListener("click", () => {
      $$(".filter-btn").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      const filter = button.dataset.filter || "all";
      $$(".gallery-item").forEach((item) => {
        item.classList.toggle("hidden", filter !== "all" && !item.classList.contains(filter));
      });
    });
  });

  $$(".gallery-item").forEach((item) => {
    item.addEventListener("click", () => {
      const image = $("#galleryModalImage");
      const source = item.dataset.full;
      const thumbnail = $("img", item);
      if (!image || !source) return;

      image.src = source;
      image.alt = thumbnail?.alt || "Mountain gallery image";
      galleryModal?.show();
    });
  });

  // ------------------------------------------------------------
  // Contact form
  // ------------------------------------------------------------
  const contactForm = $("#contactForm");
  contactForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      contactForm.classList.add("was-validated");
      return;
    }

    contactForm.reset();
    contactForm.classList.remove("was-validated");

    const toast = $("#successToast");
    if (hasBootstrap && toast) {
      bootstrap.Toast.getOrCreateInstance(toast, { delay: 3500 }).show();
    }
  });

  // ------------------------------------------------------------
  // Live ticker
  // ------------------------------------------------------------
  const ticker = $("#tickerContent");
  let locationLabel = "LOCATION UNAVAILABLE";

  const updateTicker = () => {
    if (!ticker) return;
    const now = new Date();
    const date = now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    const time = now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });

    const message = `${date.toUpperCase()} &nbsp; | &nbsp; ${time} &nbsp; | &nbsp; ${locationLabel} &nbsp;&nbsp; • &nbsp;&nbsp; ALPINE ASCENTS &nbsp;&nbsp; • &nbsp;&nbsp; CONQUER NEW HEIGHTS`;
    ticker.innerHTML = `${message} &nbsp;&nbsp; • &nbsp;&nbsp; ${message}`;
  };

  updateTicker();
  window.setInterval(updateTicker, 1000);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        locationLabel = `LAT ${position.coords.latitude.toFixed(2)} · LON ${position.coords.longitude.toFixed(2)}`;
      },
      () => {},
      { timeout: 6000, maximumAge: 600000 }
    );
  }
});
