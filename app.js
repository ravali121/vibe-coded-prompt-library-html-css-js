// app.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('prompt-form');
    const titleInput = document.getElementById('prompt-title');
    const contentInput = document.getElementById('prompt-content');
    const modelInput = document.getElementById('prompt-model');
    const promptsList = document.getElementById('prompts-list');

    // --- Metadata Tracking Functions ---
    function estimateTokens(text, isCode) {
        if (typeof text !== 'string') throw new Error('Text must be a string');
        const wordCount = text.trim().split(/\s+/).length;
        const charCount = text.length;
        let min = 0.75 * wordCount;
        let max = 0.25 * charCount;
        if (isCode) {
            min *= 1.3;
            max *= 1.3;
        }
        min = Math.round(min);
        max = Math.round(max);
        let confidence = 'high';
        const avg = (min + max) / 2;
        if (avg >= 1000 && avg < 5000) confidence = 'medium';
        if (avg >= 5000) confidence = 'low';
        return { min, max, confidence };
    }

    function trackModel(modelName, content) {
        if (typeof modelName !== 'string' || !modelName.trim())
            throw new Error('Model name must be a non-empty string');
        if (modelName.length > 100)
            throw new Error('Model name must be at most 100 characters');
        if (typeof content !== 'string' || !content.trim())
            throw new Error('Content must be a non-empty string');
        const createdAt = new Date().toISOString();
        const tokenEstimate = estimateTokens(content, false);
        return {
            model: modelName.trim(),
            createdAt,
            updatedAt: createdAt,
            tokenEstimate
        };
    }

    function updateTimestamps(metadata) {
        if (!metadata || typeof metadata !== 'object')
            throw new Error('Metadata must be an object');
        const now = new Date().toISOString();
        if (!metadata.createdAt || isNaN(Date.parse(metadata.createdAt)))
            throw new Error('createdAt must be a valid ISO 8601 string');
        if (Date.parse(now) < Date.parse(metadata.createdAt))
            throw new Error('updatedAt cannot be before createdAt');
        return { ...metadata, updatedAt: now };
    }

    function humanDate(iso) {
        const d = new Date(iso);
        return d.toLocaleString();
    }

    function getPrompts() {
        return JSON.parse(localStorage.getItem('prompts') || '[]');
    }

    function savePrompts(prompts) {
        localStorage.setItem('prompts', JSON.stringify(prompts));
    }

    function renderPrompts() {
        const prompts = getPrompts();
        // Sort by createdAt descending
        prompts.sort((a, b) => {
            const aDate = a.metadata?.createdAt || '';
            const bDate = b.metadata?.createdAt || '';
            return Date.parse(bDate) - Date.parse(aDate);
        });
        promptsList.innerHTML = '';
        if (prompts.length === 0) {
            promptsList.innerHTML = '<p style="color:#b6c2d1;text-align:center;">No prompts saved yet.</p>';
            return;
        }
        prompts.forEach((prompt, idx) => {
            const card = document.createElement('div');
            card.className = 'prompt-card';

            // Metadata display
            const meta = prompt.metadata || {};
            const modelDiv = document.createElement('div');
            modelDiv.className = 'model-name';
            modelDiv.textContent = `Model: ${meta.model || 'N/A'}`;

            const metaDiv = document.createElement('div');
            metaDiv.className = 'prompt-meta';
            metaDiv.innerHTML = `
                <span class="timestamp">Created: ${meta.createdAt ? humanDate(meta.createdAt) : 'N/A'}</span> |
                <span class="timestamp">Updated: ${meta.updatedAt ? humanDate(meta.updatedAt) : 'N/A'}</span>
            `;

            const tokenDiv = document.createElement('div');
            if (meta.tokenEstimate) {
                tokenDiv.innerHTML = `Tokens: <span class="confidence-${meta.tokenEstimate.confidence}">${meta.tokenEstimate.min} - ${meta.tokenEstimate.max} (${meta.tokenEstimate.confidence})</span>`;
            }

            const title = document.createElement('div');
            title.className = 'prompt-title';
            title.textContent = prompt.title;

            const contentPreview = document.createElement('div');
            contentPreview.className = 'prompt-content-preview';
            contentPreview.textContent = prompt.content.length > 60
                ? prompt.content.slice(0, 60) + '...'
                : prompt.content;

            // 5-star rating container
            const ratingContainer = document.createElement('div');
            ratingContainer.className = 'rating-container';
            ratingContainer.setAttribute('data-idx', idx);
            renderStars(ratingContainer, prompt.rating || 0, idx);

            // Notes section
            const notesSection = document.createElement('div');
            notesSection.className = 'notes-section';

            const notesLabel = document.createElement('label');
            notesLabel.className = 'notes-label';
            notesLabel.setAttribute('for', `note-${idx}`);
            notesLabel.textContent = 'Note:';

            const notesTextarea = document.createElement('textarea');
            notesTextarea.className = 'notes-textarea';
            notesTextarea.id = `note-${idx}`;
            notesTextarea.value = prompt.note || '';
            notesTextarea.setAttribute('rows', '2');
            notesTextarea.setAttribute('placeholder', 'Add a note...');

            const notesActions = document.createElement('div');
            notesActions.className = 'notes-actions';

            const saveNoteBtn = document.createElement('button');
            saveNoteBtn.className = 'save-note-btn';
            saveNoteBtn.textContent = 'Save Note';
            saveNoteBtn.type = 'button';
            saveNoteBtn.setAttribute('data-idx', idx);

            const deleteNoteBtn = document.createElement('button');
            deleteNoteBtn.className = 'delete-note-btn';
            deleteNoteBtn.textContent = 'Delete Note';
            deleteNoteBtn.type = 'button';
            deleteNoteBtn.setAttribute('data-idx', idx);
            if (!prompt.note) {
                deleteNoteBtn.style.display = 'none';
            }

            notesActions.appendChild(saveNoteBtn);
            notesActions.appendChild(deleteNoteBtn);

            notesSection.appendChild(notesLabel);
            notesSection.appendChild(notesTextarea);
            notesSection.appendChild(notesActions);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = 'Delete';
            deleteBtn.onclick = () => {
                deletePrompt(idx);
            };

            card.appendChild(modelDiv);
            card.appendChild(metaDiv);
            card.appendChild(tokenDiv);
            card.appendChild(title);
            card.appendChild(contentPreview);
            card.appendChild(ratingContainer);
            card.appendChild(notesSection);
            card.appendChild(deleteBtn);
            promptsList.appendChild(card);
        });
        // Add event listeners for notes actions (event delegation)
        promptsList.querySelectorAll('.save-note-btn').forEach(btn => {
            btn.onclick = function() {
                const idx = parseInt(this.getAttribute('data-idx'), 10);
                const textarea = promptsList.querySelector(`#note-${idx}`);
                const prompts = getPrompts();
                if (!prompts[idx]) return;
                prompts[idx].note = textarea.value;
                try {
                    savePrompts(prompts);
                } catch (e) {
                    alert('Error saving note. Local storage quota may be exceeded.');
                    return;
                }
                // Visual feedback
                this.classList.add('saved');
                setTimeout(() => this.classList.remove('saved'), 700);
                // Show/hide delete button
                const delBtn = this.parentElement.querySelector('.delete-note-btn');
                if (textarea.value.trim()) {
                    delBtn.style.display = '';
                } else {
                    delBtn.style.display = 'none';
                }
            };
        });
        promptsList.querySelectorAll('.delete-note-btn').forEach(btn => {
            btn.onclick = function() {
                if (!confirm('Delete this note?')) return;
                const idx = parseInt(this.getAttribute('data-idx'), 10);
                const prompts = getPrompts();
                if (!prompts[idx]) return;
                prompts[idx].note = '';
                try {
                    savePrompts(prompts);
                } catch (e) {
                    alert('Error deleting note. Local storage quota may be exceeded.');
                    return;
                }
                renderPrompts();
            };
        });
    }

    // Render stars inside a container for a given rating
    function renderStars(container, rating, promptIdx) {
        container.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star' + (i <= rating ? ' filled' : '');
            star.setAttribute('tabindex', '0');
            star.setAttribute('role', 'button');
            star.setAttribute('aria-label', `Rate ${i} star${i > 1 ? 's' : ''}`);
            star.innerHTML = '&#9733;';
            star.dataset.value = i;
            // Click to set rating
            star.addEventListener('click', () => {
                setPromptRating(promptIdx, i);
            });
            // Keyboard accessibility
            star.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    setPromptRating(promptIdx, i);
                }
            });
            // Hover effect (preview)
            star.addEventListener('mouseover', () => {
                highlightStars(container, i);
            });
            star.addEventListener('focus', () => {
                highlightStars(container, i);
            });
            star.addEventListener('mouseout', () => {
                highlightStars(container, rating);
            });
            star.addEventListener('blur', () => {
                highlightStars(container, rating);
            });
            container.appendChild(star);
        }
    }

    // Highlight stars up to a given value
    function highlightStars(container, value) {
        const stars = container.querySelectorAll('.star');
        stars.forEach((star, idx) => {
            if (idx < value) {
                star.classList.add('filled');
            } else {
                star.classList.remove('filled');
            }
        });
    }

    // Set rating for a prompt and save
    function setPromptRating(promptIdx, value) {
        const prompts = getPrompts();
        if (!prompts[promptIdx]) return;
        prompts[promptIdx].rating = value;
        savePrompts(prompts);
        renderPrompts();
    }

    function deletePrompt(index) {
        const prompts = getPrompts();
        prompts.splice(index, 1);
        savePrompts(prompts);
        renderPrompts();
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = titleInput.value.trim();
        const content = contentInput.value.trim();
        const modelName = modelInput.value.trim();
        if (!title || !content || !modelName) return;
        let metadata;
        try {
            metadata = trackModel(modelName, content);
        } catch (err) {
            alert(err.message);
            return;
        }
        const prompts = getPrompts();
        prompts.unshift({ title, content, metadata });
        savePrompts(prompts);
        form.reset();
        renderPrompts();
    });

    renderPrompts();
});
