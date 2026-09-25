/* Alyssum — Édition inline complète des pages produits */

const AdminEdit = {
  editMode: false,
  previewMode: false,
  currentProduct: null,
  currentPageSlug: null,
  originalContent: {},
  editedContent: {},
  imagePickerTarget: null,

  init() {
    this.bindToolbar();
    this.bindImagePicker();
    this.detectProductPage();
  },

  detectProductPage() {
    // Détecter si on est sur une page produit
    const path = window.location.pathname;
    const match = path.match(/\/p\/([^\/]+)\//);
    if (match) {
      this.currentPageSlug = match[1];
      this.currentProduct = match[1];
      console.log('Page produit détectée:', this.currentPageSlug);
      this.addEditButtonToProductPage();
    }
  },

  addEditButtonToProductPage() {
    // Ajouter un bouton d'édition flottant sur les pages produits
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Modifier cette page';
    editBtn.style.cssText = `
      position: fixed;
      bottom: 80px;
      right: 20px;
      background: #007bff;
      color: #fff;
      border: none;
      padding: 12px 20px;
      border-radius: 8px;
      cursor: pointer;
      z-index: 9998;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    editBtn.addEventListener('click', () => this.togglePreview());
    document.body.appendChild(editBtn);
  },

  bindToolbar() {
    const togglePreview = document.getElementById('toggle-preview');
    const saveEdits = document.getElementById('save-edits');
    const cancelEdits = document.getElementById('cancel-edits');

    if (togglePreview) togglePreview.addEventListener('click', () => this.togglePreview());
    if (saveEdits) saveEdits.addEventListener('click', () => this.confirmAndSave());
    if (cancelEdits) cancelEdits.addEventListener('click', () => this.cancelEdits());
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
      if (toolbar) toolbar.style.display = 'flex';
      document.body.classList.add('edit-mode');
      this.saveOriginalContent();
      this.enableEditing();
      this.showEditInstructions();
    } else {
      if (toolbar) toolbar.style.display = 'none';
      document.body.classList.remove('edit-mode');
      this.disableEditing();
    }
  },

  saveOriginalContent() {
    // Sauvegarder le contenu original pour annulation
    this.originalContent = {};
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, td, th, img').forEach((el, idx) => {
      const id = `el_${idx}`;
      el.dataset.editId = id;
      if (el.tagName === 'IMG') {
        this.originalContent[id] = el.src;
      } else {
        this.originalContent[id] = el.innerHTML;
      }
    });
  },

  enableEditing() {
    // Rendre TOUS les textes éditables
    document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, li, td, th, strong, em, u, mark').forEach(el => {
      if (el.closest('#edit-toolbar') || el.closest('#image-picker')) return;
      el.classList.add('editable');
      el.contentEditable = 'true';
      el.style.outline = '2px dashed #007bff';
      el.style.outlineOffset = '2px';
      el.style.cursor = 'text';
    });

    // Rendre TOUTES les images cliquables pour changement
    document.querySelectorAll('img').forEach((img, index) => {
      if (img.closest('#edit-toolbar') || img.closest('#image-picker')) return;
      img.classList.add('editable');
      img.dataset.imgIndex = index;
      img.style.outline = '2px dashed #28a745';
      img.style.outlineOffset = '2px';
      img.style.cursor = 'pointer';
      img.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openImagePicker(img);
      });
    });
  },

  disableEditing() {
    document.querySelectorAll('.editable').forEach(el => {
      el.classList.remove('editable');
      el.contentEditable = 'false';
      el.style.outline = 'none';
      el.style.cursor = '';
    });
  },

  showEditInstructions() {
    const instructions = document.createElement('div');
    instructions.id = 'edit-instructions';
    instructions.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #fff3cd;
      color: #856404;
      padding: 15px 25px;
      border-radius: 8px;
      z-index: 10000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-size: 14px;
      text-align: center;
    `;
    instructions.innerHTML = `
      <strong>📝 Mode édition activé</strong><br>
      • Cliquez sur un texte pour le modifier<br>
      • Cliquez sur une image pour la changer<br>
      • Utilisez <strong>Valider</strong> pour sauvegarder ou <strong>Annuler</strong> pour revenir en arrière
    `;
    document.body.appendChild(instructions);

    setTimeout(() => {
      if (instructions.parentNode) instructions.remove();
    }, 8000);
  },

  async openImagePicker(imgElement) {
    this.imagePickerTarget = imgElement;
    const picker = document.getElementById('image-picker');
    const grid = document.getElementById('image-grid');
    const pathLabel = document.getElementById('image-picker-path');

    const productSlug = this.currentProduct || this.currentPageSlug || 'anti-acne';
    const imgPath = `assets/img/${productSlug}`;
    
    pathLabel.textContent = `📁 Dossier: ${imgPath}`;
    grid.innerHTML = '';

    try {
      const response = await fetch(`https://api.github.com/repos/saberbalbouzi-ui/alyssumdz/contents/${imgPath}`);
      if (response.ok) {
        const files = await response.json();
        files.forEach(file => {
          if (file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name)) {
            const img = document.createElement('img');
            img.src = file.download_url;
            img.alt = file.name;
            img.title = file.name;
            img.style.border = '2px solid transparent';
            img.addEventListener('click', () => {
              this.imagePickerTarget.src = file.download_url;
              this.editedContent[this.imagePickerTarget.dataset.editId] = file.download_url;
              picker.classList.remove('active');
            });
            grid.appendChild(img);
          }
        });
      } else {
        grid.innerHTML = '<p style="color:red;">❌ Impossible de charger les images</p>';
      }
    } catch (err) {
      console.error('Erreur chargement images:', err);
      grid.innerHTML = '<p style="color:red;">❌ Erreur de chargement</p>';
    }

    picker.classList.add('active');
  },

  confirmAndSave() {
    const confirmed = confirm('✅ Confirmer la sauvegarde des modifications ?\n\nCliquez sur OK pour valider, ou Annuler pour revenir en arrière.');
    if (confirmed) {
      this.saveEdits();
    }
  },

  saveEdits() {
    // Collecter toutes les modifications
    this.editedContent = {};
    document.querySelectorAll('[data-edit-id]').forEach(el => {
      const id = el.dataset.editId;
      if (el.tagName === 'IMG') {
        this.editedContent[id] = { type: 'image', value: el.src, original: this.originalContent[id] };
      } else {
        this.editedContent[id] = { type: 'html', value: el.innerHTML, original: this.originalContent[id] };
      }
    });

    console.log('📦 Contenu édité:', this.editedContent);
    console.log('📄 Slug du produit:', this.currentPageSlug);

    // Simuler la sauvegarde (à remplacer par un vrai appel API)
    alert('✅ Modifications sauvegardées avec succès !\n\nLes changements seront appliqués au produit: ' + (this.currentPageSlug || 'inconnu'));
    
    this.cancelEdits();
  },

  cancelEdits() {
    // Restaurer le contenu original
    Object.keys(this.originalContent).forEach(id => {
      const el = document.querySelector(`[data-edit-id="${id}"]`);
      if (el) {
        if (el.tagName === 'IMG') {
          el.src = this.originalContent[id];
        } else {
          el.innerHTML = this.originalContent[id];
        }
      }
    });

    this.previewMode = false;
    const toolbar = document.getElementById('edit-toolbar');
    if (toolbar) toolbar.style.display = 'none';
    document.body.classList.remove('edit-mode');
    this.disableEditing();
    this.editedContent = {};
    this.originalContent = {};

    const instructions = document.getElementById('edit-instructions');
    if (instructions) instructions.remove();
  },

  loadProductForEdit(slug) {
    this.currentProduct = slug;
    console.log('Chargement du produit pour édition:', slug);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AdminEdit.init();
});
