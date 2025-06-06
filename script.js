// --- Firebase Configuration and Initialization ---
// IMPORTANT: This is your specific project's connection details.
const firebaseConfig = {
    apiKey: "AIzaSyDr3x1IwVQrOgsAZNpWDfnNOrchpa6oB-o",
    authDomain: "combine-project-9f980.firebaseapp.com",
    projectId: "combine-project-9f980",
    storageBucket: "combine-project-9f980.firebasestorage.app",
    messagingSenderId: "727555497020",
    appId: "1:727555497020:web:4bc21ebcd31fb87ceab739",
    measurementId: "G-TN26K5KPJR"
};

// IMPORTANT: This is your secret admin key.
// It MUST match the key you set in your Firestore Security Rules EXACTLY.
// This key will be sent with write operations from the Admin page.
const ADMIN_SECRET_KEY = "RuiruMediaHouse@2025SecretE"; // <-- YOUR SECRET KEY IS HERE

// Import Firebase functions from CDN
// We need initializeApp for the core app, getFirestore for the database,
// and specific functions for collections, adding, deleting, querying, and real-time listening.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js";
import { getFirestore, collection, addDoc, deleteDoc, doc, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js";

// Initialize Firebase app and Firestore database instance
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Get a reference to the 'content_items' collection in Firestore.
// This is where all your content (sermons, entertainment, etc.) will be stored.
const contentCollectionRef = collection(db, "content_items");

document.addEventListener('DOMContentLoaded', () => {
    // Select DOM elements (unchanged from previous local storage version, but now interact with Firestore)
    const mobileNav = document.querySelector('.mobile-nav');
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const addContentButtons = document.querySelectorAll('.add-content-btn');
    const addContentModal = document.getElementById('addContentModal');
    const closeButton = document.querySelector('.close-button');
    const addContentForm = document.getElementById('addContentForm');
    const contentTypeInput = document.getElementById('contentType');
    const contentTitleInput = document.getElementById('contentTitle');
    const contentDescriptionInput = document.getElementById('contentDescription');
    const contentURLInput = document.getElementById('contentURL');

    // --- Sidebar Toggle for Mobile ---
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
        });
    }

    // --- Navigation and Content Switching Logic ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetSectionId = e.currentTarget.dataset.section + '-section';
            const targetSectionName = e.currentTarget.dataset.section; // e.g., 'home', 'sermons'

            // Remove 'active' class from all nav items and content sections
            navItems.forEach(nav => nav.classList.remove('active'));
            contentSections.forEach(section => section.classList.remove('active'));

            // Add 'active' class to clicked nav item
            e.currentTarget.classList.add('active');

            // Show the corresponding content section
            const targetSection = document.getElementById(targetSectionId);
            if (targetSection) {
                targetSection.classList.add('active');
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('active');
                }
            }

            // Load content from Firebase for the newly active section
            if (targetSectionName !== 'home') { // Don't try to load content from Firestore for the static home section
                loadContentFirebase(targetSectionName);
            }
        });
    });

    // --- Modal for Adding New Content (UI handling is unchanged) ---
    addContentButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const section = e.currentTarget.dataset.section;
            contentTypeInput.value = section;
            addContentModal.style.display = 'flex';
        });
    });

    closeButton.addEventListener('click', () => {
        addContentModal.style.display = 'none';
        addContentForm.reset();
    });

    window.addEventListener('click', (e) => {
        if (e.target === addContentModal) {
            addContentModal.style.display = 'none';
            addContentForm.reset();
        }
    });

    // --- Handle form submission for adding new content to Firestore ---
    addContentForm.addEventListener('submit', async (e) => { // Added 'async' keyword
        e.preventDefault();

        const section = contentTypeInput.value;
        const title = contentTitleInput.value.trim();
        const description = contentDescriptionInput.value.trim();
        const url = contentURLInput.value.trim();

        if (!title) {
            console.error("Content title cannot be empty.");
            // In a real app, you'd show a user-friendly error message in the UI, not just console
            return;
        }

        // Create a new content object.
        // The 'category' field is crucial for filtering content in Firestore.
        // The 'adminKey' is included to satisfy Firestore security rules for write access.
        const newContent = {
            title: title,
            description: description,
            url: url,
            category: section,
            timestamp: new Date(), // Add a timestamp for potential ordering (e.g., newest first)
            adminKey: ADMIN_SECRET_KEY // IMPORTANT: Include the secret key for Firestore write access
        };

        try {
            // Use addDoc to add a new document to the 'content_items' collection in Firestore
            await addDoc(contentCollectionRef, newContent);
            console.log("Document successfully written with ID: ", newContent.id); // Firestore generates ID, we won't get it back directly from addDoc
            addContentModal.style.display = 'none'; // Hide the modal
            addContentForm.reset(); // Clear the form
            // The loadContentFirebase function (which uses onSnapshot) will automatically update the UI
            // so we don't need to call it explicitly here after a successful add.
        } catch (error) {
            console.error("Error writing document to Firestore: ", error);
            // In a real app, display this error to the user in the UI
        }
    });

    /**
     * Extracts YouTube video ID from various YouTube URL formats.
     * This function is crucial for embedding YouTube videos.
     * @param {string} url - The full YouTube video URL.
     * @returns {string|null} The YouTube video ID (11 characters) or null if not found.
     */
    function getYouTubeVideoId(url) {
        let videoId = null;
        // Regex to match common YouTube URL patterns and capture the 11-character video ID
        const regex = /(?:https?:\/\/)?(?:www\.)?(?:m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|)([\w-]{11})(?:\S+)?/;
        const match = url.match(regex);
        if (match && match[1]) {
            videoId = match[1]; // The video ID is captured in the first group of the regex
        }
        return videoId;
    }

    /**
     * Loads and displays content for a specific section from Firestore.
     * Uses a real-time listener (onSnapshot) for automatic updates.
     * @param {string} section - The section name (e.g., 'sermons', 'events').
     */
    function loadContentFirebase(section) {
        const contentContainer = document.getElementById(`${section}-container`);
        if (!contentContainer) {
            console.warn(`Content container for section "${section}" not found.`);
            return;
        }

        // Create a query to get documents from "https://esm.sh/content_items" collection
        // Filter by 'category' to get only relevant items for the current section.
        // For 'orderBy("timestamp", "desc")', you might need to create an index in Firestore.
        // Firebase console will usually give you a link to create it if needed.
        const q = query(
            contentCollectionRef,
            where("category", "==", section),
            // orderBy("timestamp", "desc") // <-- Uncomment this line if you want to order by time (newest first).
                                           // If you uncomment, Firebase console will prompt you to create an index.
        );

        // Set up a real-time listener: onSnapshot
        // This function will be called every time there's a change in the queried data (add, update, delete)
        // so the UI will automatically refresh.
        const unsubscribe = onSnapshot(q, (snapshot) => {
            contentContainer.innerHTML = ''; // Clear existing content before rendering new data

            if (snapshot.empty) {
                contentContainer.innerHTML = '<p class="text-center-message">No content added yet. Click "Add New Content" to get started.</p>';
                return;
            }

            snapshot.forEach(docSnapshot => {
                const item = docSnapshot.data(); // Get the document's data
                const docId = docSnapshot.id; // Get the unique document ID from Firestore (needed for deletion)

                const contentItemDiv = document.createElement('div');
                contentItemDiv.classList.add('content-item');

                let mediaContent = '';
                const youtubeId = item.url ? getYouTubeVideoId(item.url) : null;

                if (youtubeId) {
                    // If a YouTube video ID is found, create an iframe for embedding
                    mediaContent = `
                        <div class="video-container">
                            <iframe
                                src="https://www.youtube.com/embed/${youtubeId}?rel=0"
                                frameborder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowfullscreen
                                title="${item.title || 'YouTube video player'}"
                            ></iframe>
                        </div>
                    `;
                } else if (item.url) {
                    // If it's not a YouTube URL but still a URL, provide a standard clickable link
                    mediaContent = `<a href="${item.url}" target="_blank" rel="noopener noreferrer">View Content</a>`;
                }

                // Construct the inner HTML for the content item
                contentItemDiv.innerHTML = `
                    <h3>${item.title}</h3>
                    <p>${item.description}</p>
                    ${mediaContent} <!-- Insert the generated media content (video or link) -->
                    <button class="delete-content-btn" data-id="${docId}" data-section="${section}">Delete</button>
                `;
                contentContainer.appendChild(contentItemDiv); // Add the new item to the container
            });

            // Add event listeners for all newly created delete buttons
            // This needs to be done inside onSnapshot because content is re-rendered each time data changes
            document.querySelectorAll('.delete-content-btn').forEach(button => {
                button.addEventListener('click', async (e) => { // Added 'async' for async operations
                    const idToDelete = e.currentTarget.dataset.id; // Get Firestore document ID from data attribute
                    const sectionToDeleteFrom = e.currentTarget.dataset.section;

                    // A simple confirmation dialog. For a real app, use a custom modal for better UX.
                    if (confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
                         try {
                            // Use deleteDoc to remove the document from Firestore.
                            // We need to provide the database instance (db), collection name, and document ID.
                            await deleteDoc(doc(db, "content_items", idToDelete));
                            console.log("Document successfully deleted from Firestore!");
                            // The loadContentFirebase function (onSnapshot) will automatically update the UI.
                        } catch (error) {
                            console.error("Error deleting document from Firestore: ", error);
                            // In a real app, display this error to the user in the UI.
                        }
                    }
                });
            });
        }, (error) => {
            // Error handling for the Firestore listener
            console.error("Error fetching documents from Firestore: ", error);
            contentContainer.innerHTML = '<p class="text-center-message">Error loading content. Please check your internet connection and Firebase rules.</p>';
        });

        // IMPORTANT: In a more complex app with many listeners, you would want to store 'unsubscribe'
        // and call it when the component/section is no longer active to prevent memory leaks.
        // For this simple single-page app structure, it's less critical, but good practice.
        // return unsubscribe;
    }

    // --- Initial Page Load ---
    // Simulate clicking the "Home" nav item on page load
    const initialNavItem = document.querySelector('.nav-item[data-section="home"]');
    if (initialNavItem) {
        initialNavItem.click();
    }
});