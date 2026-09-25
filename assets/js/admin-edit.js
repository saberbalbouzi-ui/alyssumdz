/* Alyssum — Édition inline des pages produits */

const AdminEdit = {
  editMode: false,
  previewMode: false,
  currentProduct: null,
  editedContent: {},
  imagePickerTarget: null,

  init() {
    this.bindToolbar();
    this.bindImagePicker();
  },

  bindToolbar() {
    const togglePreview = document.getElementById('toggle-preview');
    const saveEdits = document.getElementById('save-edits');
    const cancelEdits = document.getElementById('cancel-edits');

    if (!togglePreview || !saveEdits || !cancelEdits) return;

    togglePreview.addEventListener('click', () => this.togglePreview());
    saveEdits.addEventListener('click', () => this.saveEdits());
    cancelEdits.addEventListener('click', () => this.cancelEdits());
  },

  bindImagePicker() {
    const closeBtn = document.getElementById('close-image-picker');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        document.getElementById('image-picker').classList.remove('active');
      });
    }
  },

  togglePreview() {
    this.previewMode = !this.previewMode;
    const toolbar = document.getElementById('edit-toolbar');
    
    if (this.previewMode) {
      toolbar.style.display = 'flex';
      document.body.classList.add('edit-mode');
      this.enableEditing();
    } else {
      toolbar.style.display = 'none';
      document.body.classList.remove('edit-mode');
      this.disableEditing();
    }
  },

  enableEditing() {
    // Rendre les textes éditables
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, td, th').forEach(el => {
      if (el.closest('#dashboard-content') || el.closest('#edit-toolbar') || el.closest('#image-picker')) return;
      el.classList.add('editable');
      el.contentEditable = 'true';
      el.addEventListener('input', () => {
        this.editedContent[el.dataset.editId || el.textContent] = el.textContent;
      });
    });

    // Rendre les images cliquables pour changement
    document.querySelectorAll('img').forEach((img, index) => {
      if (img.closest('#dashboard-content') || img.closest('#edit-toolbar') || img.closest('#image-picker')) return;
      img.classList.add('editable');
      img.dataset.imgIndex = index;
      img.addEventListener('click', (e) => {
        e.preventDefault();
        this.openImagePicker(img);
      });
    });
  },

  disableEditing() {
    document.querySelectorAll('.editable').forEach(el => {
      el.classList.remove('editable');
      el.contentEditable = 'false';
    });
  },

  async openImagePicker(imgElement) {
    this.imagePickerTarget = imgElement;
    const picker = document.getElementById('image-picker');
    const grid = document.getElementById('image-grid');
    const pathLabel = document.getElementById('image-picker-path');

    // Déterminer le dossier d'images selon le produit actuel
    const productSlug = this.currentProduct || 'anti-acne';
    const imgPath = `assets/img/${productSlug}`;
    
    pathLabel.textContent = `Dossier: ${imgPath}`;
    grid.innerHTML = '';

    // Charger les images depuis le dossier
    try {
      const response = await fetch(`https://api.github.com/repos/saberbalbouzi-ui/alyssumdz/contents/${imgPath}`);
      if (response.ok) {
        const files = await response.json();
        files.forEach(file => {
          if (file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name)) {
            const img = document.createElement('img');
            img.src = file.download_url;
            img.alt = file.name;
            img.addEventListener('click', () => {
              this.imagePickerTarget.src = file.download_url;
              this.editedContent[this.imagePickerTarget.dataset.imgId || this.imagePickerTarget.src] = file.download_url;
              picker.classList.remove('active');
            });
            grid.appendChild(img);
          }
        });
      }
    } catch (err) {
      console.error('Erreur chargement images:', err);
    }

    picker.classList.add('active');
  },

  saveEdits() {
    // Sauvegarder les modifications
    console.log('Contenu édité:', this.editedContent);
    alert('✅ Modifications sauvegardées (simulation)');
    this.cancelEdits();
  },

  cancelEdits() {
    this.previewMode = false;
    document.getElementById('edit-toolbar').style.display = 'none';
    document.body.classList.remove('edit-mode');
    this.disableEditing();
    this.editedContent = {};
  },

  loadProductForEdit(slug) {
    this.currentProduct = slug;
    console.log('Chargement du produit pour édition:', slug);
  }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  AdminEdit.init();
});
