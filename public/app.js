class CSVProcessor {
    constructor() {
        this.files = new Set();
        this.initializeElements();
        this.setupEventListeners();
        this.startStatusPolling();
    }

    initializeElements() {
        this.dropZone = document.getElementById('dropZone');
        this.fileInput = document.getElementById('fileInput');
        this.fileList = document.getElementById('fileList');
        this.uploadButton = document.getElementById('uploadButton');
        this.statusBadge = document.getElementById('status-badge');
        this.activeStreams = document.getElementById('activeStreams');
        this.resultsList = document.getElementById('resultsList');
    }

    setupEventListeners() {
        this.dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.dropZone.classList.add('drag-over');
        });

        this.dropZone.addEventListener('dragleave', () => {
            this.dropZone.classList.remove('drag-over');
        });

        this.dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.dropZone.classList.remove('drag-over');
            const files = Array.from(e.dataTransfer.files).filter(file => file.name.endsWith('.csv'));
            this.handleFiles(files);
        });

        this.fileInput.addEventListener('change', () => {
            const files = Array.from(this.fileInput.files);
            this.handleFiles(files);
        });

        this.uploadButton.addEventListener('click', () => this.processFiles());
    }

    handleFiles(files) {
        files.forEach(file => {
            if (!this.files.has(file)) {
                this.files.add(file);
                this.addFileToList(file);
            }
        });
        this.updateUploadButton();
    }

    addFileToList(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name}</span>
            <span class="remove-file">×</span>
        `;

        fileItem.querySelector('.remove-file').addEventListener('click', () => {
            this.files.delete(file);
            fileItem.remove();
            this.updateUploadButton();
        });

        this.fileList.appendChild(fileItem);
    }

    updateUploadButton() {
        this.uploadButton.disabled = this.files.size === 0;
    }

    async processFiles() {
        if (this.files.size === 0) return;

        const formData = new FormData();
        this.files.forEach(file => {
            formData.append('files', file);
        });

        try {
            this.uploadButton.disabled = true;
            const response = await fetch('/api/process', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.results && Array.isArray(result.results)) {
                this.displayResults(result.results);
            } else {
                throw new Error('Invalid response format');
            }

            this.files.clear();
            this.fileList.innerHTML = '';
            this.updateUploadButton();
        } catch (error) {
            console.error('Error processing files:', error);
            this.displayError(error.message || 'Failed to process files. Please try again.');
        } finally {
            this.uploadButton.disabled = false;
        }
    }

    displayResults(results) {
        // Clear previous results
        this.resultsList.innerHTML = '';

        if (!results || results.length === 0) {
            this.displayError('No results to display');
            return;
        }

        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = `result-item ${result.status}`;
            resultItem.innerHTML = `
                <span>${result.filename}</span>
                <span>${result.status}${result.error ? ': ' + result.error : ''}</span>
            `;
            this.resultsList.appendChild(resultItem);
        });
    }

    displayError(message) {
        const errorItem = document.createElement('div');
        errorItem.className = 'result-item error';
        errorItem.textContent = message;
        this.resultsList.appendChild(errorItem);
    }

    async startStatusPolling() {
        const updateStatus = async () => {
            try {
                const response = await fetch('/api/status');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (this.activeStreams) {
                    this.activeStreams.textContent = data.activeStreams || '0';
                }
                
                if (this.statusBadge) {
                    this.statusBadge.textContent = data.status || 'Unknown';
                    this.statusBadge.className = `status-badge ${(data.status || '').toLowerCase()}`;
                }
            } catch (error) {
                console.error('Error fetching status:', error);
                if (this.statusBadge) {
                    this.statusBadge.textContent = 'Connection Error';
                    this.statusBadge.className = 'status-badge error';
                }
            }
        };

        await updateStatus();
        setInterval(updateStatus, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new CSVProcessor();
});
