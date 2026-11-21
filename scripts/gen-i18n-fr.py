#!/usr/bin/env python3
"""يولّد assets/data/i18n-fr.json: قاموس الواجهة العربية ← الفرنسية للوحة (يُحمَّل عند تبديل اللغة).
التوسعة: أضف أزواجاً إلى PAIRS (النص العربي كما يظهر بالضبط ← الفرنسي) ثم شغّل: python3 scripts/gen-i18n-fr.py
النصوص غير الموجودة تبقى بالعربية (احتياط). أنماط الأرقام/المبالغ في PATTERNS."""
import json, re, sys, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
html = open(os.path.join(ROOT, 'admin.html'), encoding='utf-8').read()

# عناوين الأقسام (قائمة التنقل) وشروحها: مفتاح القسم ← (عنوان، شرح)
NAV_FR = {
 'home': ('Tableau de bord', "Vue d'ensemble des ventes, commandes et alertes"),
 'store': ('Paramètres du site', 'Nom, domaine, contact, langue et fuseau, mes sites'),
 'blog': ('Blog et politiques', 'Articles et pages confidentialité, retours, livraison, conditions'),
 'products': ('Produits', 'Ajouter et modifier produits, images et prix'),
 'builder': ('Pages', "Pages d'atterrissage, accueil et fiches produit : création et édition"),
 'categories': ('Catégories', "Catégories de la boutique affichées sur l'accueil"),
 'attributes': ('Attributs', 'Bibliothèque d’attributs (couleur, taille…) pour les produits'),
 'analytics': ('Analyses', 'Meilleures ventes et répartition des commandes par wilaya'),
 'bulkp': ('Édition en masse', 'Modifier prix et champs de plusieurs produits en une fois'),
 'audit': ('Audit des produits', 'Qualité des images, descriptions, prix et liens'),
 'seo': ('SEO', 'Titres et descriptions produits, partage social et noindex'),
 'orders': ('Commandes', 'Afficher, chercher et confirmer les commandes clients'),
 'callcenter': ("Centre d'appels", 'Une commande à la fois, gros boutons : confirmer, sans réponse, plus tard, faux numéro'),
 'pack': ('Préparation', 'Liste de ramassage et bon de préparation pour le magasinier'),
 'shipped': ('Commandes enregistrées', 'Commandes envoyées au transporteur et leur statut réel'),
 'dispatch': ('Routage et bordereaux', 'Router les commandes vers les transporteurs, envoyer et imprimer les bordereaux'),
 'ruqya': ('Rendez-vous Roqya', 'Réservations du samedi : confirmer, annuler, contacter'),
 'returns': ('Retours', 'Colis retournés par le transporteur et leur état'),
 'finance': ('Stock et profits', 'Stock synchronisé avec les commandes et profit réel par produit'),
 'profit': ('Profit réel', 'Net après livraison, retours, marchandise et publicités'),
 'payments': ('Paiements', 'Statut de paiement manuel : payé / non payé / remboursé'),
 'costs': ('Coût des produits', "Prix d'achat : direct ou calculé à partir des matières premières"),
 'wallet': ('Portefeuille', 'Votre solde sur la plateforme : garantie, retraits et crédit publicitaire'),
 'delivery': ('Transporteurs', 'Relier les comptes et clés API des transporteurs'),
 'fees': ('Frais de livraison', 'Tarif de livraison pour chacune des 58 wilayas'),
 'inventory': ('Stock', 'Quantités, alertes et modifications en masse'),
 'coupons': ('Codes promo', 'Créer des codes de réduction affichés automatiquement sur le site'),
 'upsell': ('Offres complémentaires', 'Order Bump et offre après achat pour augmenter le panier'),
 'pixels': ('Pixels', 'Relier les pixels Facebook/TikTok/Google pour le suivi'),
 'social': ('Réseaux sociaux et pubs', 'Planifier les publications et gérer les campagnes'),
 'repeat': ('Réachat', 'Messages WhatsApp aux anciens clients avec code promo'),
 'loyalty': ('Clients fidèles', 'Clients ayant passé plusieurs commandes, avec récompense et notification'),
 'customers': ('Clients', "Segments de clients, historique des commandes et notes"),
 'blacklist': ('Liste noire', 'Numéros de téléphone signalés en cas de commandes répétées'),
 'reports': ('Rapports', 'Ventes par période, catégorie, wilaya et campagne'),
 'sources': ('Centre des boutiques', 'Commandes Shopify, WooCommerce et Google Sheets de toutes vos boutiques'),
 'market': ('Marketing d’affiliation', 'Vendre des produits de fournisseurs à la commission ou lister les vôtres'),
 'agency': ('Services marketing', 'Achetez un compte TikTok/Meta Ads prêt à l’emploi depuis votre portefeuille'),
 'digital': ('Produits numériques', 'Clés, comptes et fichiers livrés automatiquement après paiement'),
 'experts': ('Réseau d’experts', 'Freelances algériens : designers, media buyers, confirmateurs, livreurs'),
 'appstore': ('Boutique d’extensions', 'Installez des applications de développeurs indépendants avec les droits que vous définissez'),
 'appdev': ('Pour les développeurs', 'Créez votre application, suivez livraisons, revenus et vérification de domaine'),
 'studio': ('Studio de design', 'Tous les outils image et design au même endroit'),
 'checkout': ('Formulaire de commande', 'Couleurs, champs, boutons, offres, numéro WhatsApp'),
 'speed': ('Vitesse du site', 'Analyse des performances mobile et ordinateur avec liste des erreurs'),
 'admtheme': ('Apparence du tableau de bord', 'Sombre ou clair, couleur principale et taille de police'),
 'theme': ('Apparence du site', 'Police, couleurs, logo et SEO de la page d’accueil'),
}

PAIRS = {
 # شريط علوي وعام
 'لوحة تحكم ALYSSUM': 'Tableau de bord ALYSSUM', 'لوحة تحكم أليسوم': 'Tableau de bord ALYSSUM',
 'سجّل الدخول بحساب المدير': 'Connectez-vous avec le compte administrateur', 'دخول': 'Connexion',
 'معاينة الموقع': 'Aperçu du site', 'المكتب': 'Bureau', 'تابلت': 'Tablette', 'الهاتف': 'Téléphone', 'تثبيت': 'Installer',
 'تعديل': 'Modifier', 'إغلاق': 'Fermer', 'اسألني': 'Demandez-moi', 'تحديث متاح': 'Mise à jour disponible', 'زيارة الموقع': 'Voir le site',
 'داكن': 'Sombre', 'فاتح': 'Clair', 'تحديث': 'Actualiser', 'مسح الكاش': 'Vider le cache', 'خروج': 'Déconnexion',
 'الإعدادات العامة': 'Paramètres généraux', 'المنتجات': 'Produits', 'المتجر': 'Boutique', 'المظهر': 'Apparence', 'إضافات': 'Extensions',
 'دليل الاستخدام': "Guide d'utilisation", 'لوحة التحكم': 'Tableau de bord', 'إعدادات الموقع': 'Paramètres du site', 'المدوّنة والسياسات': 'Blog et politiques',
 'تجهيز المتجر': 'Préparation de la boutique', 'الصفحات': 'Pages', 'التصنيفات': 'Catégories', 'السمات': 'Attributs', 'التحليلات': 'Analyses', 'تعديل جماعي': 'Édition en masse',
 'فحص المنتجات': 'Audit des produits', 'العمليات اليومية': 'Opérations quotidiennes', 'الطلبات': 'Commandes', 'مركز الاتصال': "Centre d'appels", 'تجهيز الطلبات': 'Préparation',
 'الطلبات المسجلة': 'Commandes enregistrées', 'التوجيه والبوردرو': 'Routage et bordereaux', 'مواعيد الرقية': 'Rendez-vous Roqya', 'المرتجعات': 'Retours',
 'المال والربح': 'Finances et profit', 'المخزون والأرباح': 'Stock et profits', 'الربح الحقيقي': 'Profit réel', 'المدفوعات': 'Paiements', 'تكلفة المنتجات': 'Coût des produits', 'المحفظة': 'Portefeuille',
 'الشحن والمخزون': 'Livraison et stock', 'شركات التوصيل': 'Transporteurs', 'رسوم التوصيل': 'Frais de livraison', 'المخزون': 'Stock',
 'التسويق والمبيعات': 'Marketing et ventes', 'أكواد الخصم': 'Codes promo', 'العروض الإضافية': 'Offres complémentaires', 'البكسلات': 'Pixels', 'السوشيال والإعلانات': 'Réseaux sociaux et pubs', 'إعادة الشراء': 'Réachat', 'الزبائن الأوفياء': 'Clients fidèles',
 'العملاء والتقارير': 'Clients et rapports', 'العملاء': 'Clients', 'القائمة السوداء': 'Liste noire', 'التقارير': 'Rapports',
 'خدمات وإضافات المنصة': 'Services et extensions', 'مركز المتاجر': 'Centre des boutiques', 'التسويق بالعمولة': "Marketing d'affiliation", 'خدمات التسويق': 'Services marketing', 'المنتجات الرقمية': 'Produits numériques', 'شبكة الخبراء': "Réseau d'experts", 'متجر الإضافات': "Boutique d'extensions", 'للمطوّرين': 'Pour les développeurs',
 'مطوّر الصفحات': 'Éditeur de pages', 'المطوّر الذكي': 'Éditeur intelligent', 'معالجة الصور والكتالوج': 'Traitement des images et catalogue', 'مولّد الصور': "Générateur d'images", 'الوكيل الذكي': 'Agent intelligent', 'معطّل': 'Désactivé', 'الوكيل الناطق': 'Agent vocal', 'ناسخ القوالب': 'Copieur de modèles', 'الأيقونات العائمة': 'Icônes flottantes', 'حماية الموقع': 'Protection du site', 'ستوديو ديزاين': 'Studio de design',
 'نموذج الطلب': 'Formulaire de commande', 'سرعة الموقع': 'Vitesse du site', 'مظهر لوحة التحكم': 'Apparence du tableau de bord', 'مظهر الموقع': 'Apparence du site', 'الهيدر': 'En-tête', 'الفوتر': 'Pied de page', 'قوالب': 'Modèles', 'الرئيسية': 'Accueil',
 'مساء الخير': 'Bonsoir', 'صباح الخير': 'Bonjour', 'مرحباً': 'Bonjour',
 # الرئيسية
 'اليوم': "Aujourd'hui", '7 أيام': '7 jours', '30 يوماً': '30 jours', 'هذا الشهر': 'Ce mois', 'مخصص': 'Personnalisé', '+ طلب': '+ Commande', 'كل الطلبات': 'Toutes les commandes', 'المرسَلة اليوم': "Envoyées aujourd'hui", '+ منتج': '+ Produit',
 'إحصائيات اليوم': "Statistiques du jour", 'عدد الطلبات المرسَلة': 'Commandes envoyées', 'السعر الإجمالي': 'Prix total', 'مجموع ما يدفعه الزبائن': 'Total payé par les clients', 'سعر التوصيل': 'Frais de livraison', 'تعريفة الشركات': 'Tarifs des transporteurs', 'الصافي': 'Net', 'الإجمالي − التوصيل': 'Total − livraison',
 'جارٍ التحميل…': 'Chargement…', 'صافي الشركات': 'Net des transporteurs', 'المبيعات': 'Ventes', 'جديد': 'Nouveau', 'عن الفترة السابقة': 'vs période précédente', 'في انتظار التأكيد': 'En attente de confirmation', 'متوسط قيمة الطلب': 'Panier moyen',
 'نسب التسليم والإرجاع': 'Taux de livraison et de retour', 'تم التسليم': 'Livré', 'مرتجعة / فشل': 'Retournée / échec', 'قيد الطريق': 'En route', 'نسبة التسليم حسب الولاية': 'Taux de livraison par wilaya', 'الولاية': 'Wilaya', 'المسلَّمة': 'Livrées', 'الطلبات': 'Commandes',
 'الربح الصافي المحقق': 'Profit net réalisé', 'التفاصيل': 'Détails', 'ربح متوقع (قيد التوصيل)': 'Profit attendu (en livraison)', 'الهامش على المبيعات': 'Marge sur les ventes', 'مخطط المبيعات': 'Courbe des ventes', 'مخطط الطلبات': 'Courbe des commandes', 'عرض كجدول': 'Afficher en tableau',
 'الطلبات حسب الحالة': 'Commandes par statut', 'قيد التجهيز': 'En préparation', 'في الطريق': 'En route', 'ملغاة / فشل': 'Annulées / échec', 'آخر الطلبات': 'Dernières commandes', 'عرض الكل': 'Voir tout', 'الزبون': 'Client', 'المبلغ': 'Montant', 'الحالة': 'Statut', 'التاريخ': 'Date', 'زبون': 'Client',
 'يحتاج انتباهك': 'À surveiller', 'طلب في انتظار التأكيد': 'commande en attente de confirmation', 'منتج مخزونه منخفض (5 أو أقل)': 'produit à stock faible (5 ou moins)', 'منتج نفد من المخزون': 'produit en rupture de stock', 'طلب جديد يفوق المخزون': 'nouvelle commande dépassant le stock', 'طلب بلا استجابة منذ مدة': 'commande sans réponse depuis un moment', 'فشل توصيل / مرتجع': 'Échec de livraison / retour', 'أفضل المنتجات مبيعاً': 'Meilleures ventes', 'تفعيل خدمة تأكيد الزبائن': 'Activer le service de confirmation clients',
 'تحقق من زبون': 'Vérifier un client', 'أرشيف الطلبات': 'Archive des commandes', 'إضافة طلب جديد': 'Ajouter une commande', 'الأرشيف': 'Archive', 'سلة المهملات': 'Corbeille', 'السلال المتروكة': 'Paniers abandonnés',
 # الطلبات
 'كل الحالات': 'Tous les statuts', 'جديد (لم يُتصل به بعد)': 'Nouveau (pas encore appelé)', 'مؤكَّد': 'Confirmé', 'ملغاة': 'Annulée', 'فشل التوصيل': 'Échec de livraison', 'المزيد من الفلاتر والأدوات': "Plus de filtres et d'outils", 'استيراد الطلبات القديمة': 'Importer les anciennes commandes',
 'كل الولايات': 'Toutes les wilayas', 'كل المصادر': 'Toutes les sources', 'من الموقع': 'Du site', 'من الحملة': 'De la campagne', 'من الرابط (بلا حملة)': 'Du lien (sans campagne)', 'من ماسنجر': 'De Messenger', 'يدوية': 'Manuelles', 'من': 'De', 'إلى': 'À', 'إظهار المسجلة': 'Afficher les enregistrées', '↩ مسح الفلاتر': '↩ Effacer les filtres',
 'تصدير CSV': 'Exporter CSV', 'نسخ لـ Google Sheets': 'Copier vers Google Sheets', 'تحديث حالات الشحن': 'Actualiser les statuts de livraison', 'إشعارات الزبائن': 'Notifications clients', 'آخر 7 أيام': '7 derniers jours', 'تنتظر التأكيد': 'En attente', '+ حفظ العرض الحالي': '+ Enregistrer la vue actuelle',
 'تغيير الحالة إلى…': 'Changer le statut en…', 'تطبيق': 'Appliquer', 'تأكيد المحدد': 'Confirmer la sélection', 'إرسال المحدد للشركة': 'Envoyer la sélection au transporteur', 'نسخ الأرقام': 'Copier les numéros', 'طباعة': 'Imprimer', 'فواتير (A4)': 'Factures (A4)', 'جدول الطلبات المحددة': 'Tableau des commandes sélectionnées', 'تحميل': 'Télécharger', 'ملف Excel': 'Fichier Excel', 'إجراءات': 'Actions',
 'نقل المحدد إلى سلة المهملات': 'Mettre la sélection à la corbeille', 'تحديد كل النتائج': 'Sélectionner tous les résultats', 'إلغاء التحديد': 'Désélectionner', 'كل الشركات': 'Tous les transporteurs', 'فشل / مرتجع': 'Échec / retour', 'تحديث الحالة': 'Actualiser le statut', 'نسخة CSV': 'Copie CSV', 'طباعة البوردرو': 'Imprimer le bordereau', 'إضافة طرد بالتتبع': 'Ajouter un colis par suivi', 'آخر الطرود عند الشركة': 'Derniers colis chez le transporteur', 'مطابقة مع ياليدين': 'Rapprocher avec Yalidine',
 'محدَّد:': 'Sélection :', 'الاسم': 'Nom', 'الهاتف ': 'Téléphone', 'المنتج': 'Produit', 'المصدر': 'Source', 'الوجهة': 'Destination', 'الشركة': 'Transporteur', 'التتبع': 'Suivi', 'البلدية': 'Commune', 'الكمية': 'Quantité',
 'بحث بالاسم أو الهاتف...': 'Rechercher par nom ou téléphone…', 'بحث بالاسم أو المعرف...': "Rechercher par nom ou identifiant…", 'بحث بالاسم أو slug': 'Rechercher par nom ou slug', 'بحث بالاسم أو الهاتف أو المنتج': 'Rechercher par nom, téléphone ou produit', 'بحث بالهاتف أو الاسم أو الولاية…': 'Rechercher par téléphone, nom ou wilaya…', 'بحث': 'Rechercher', 'بحث عن ولاية...': 'Chercher une wilaya…', 'بحث سريع عن أي إعداد أو قسم…': "Recherche rapide d'un réglage ou d'une section…", 'بحث سريع عن أي إعداد': "Recherche rapide d'un réglage",
 'القائمة': 'Menu', 'حسابي والإعدادات': 'Mon compte et réglages', 'إغلاق القائمة': 'Fermer le menu', 'تبديل مظهر لوحة التحكم': "Changer l'apparence", 'الميكروفون متوقف — اضغط لتشغيله': 'Micro coupé — touchez pour activer', 'تحديد الكل': 'Tout sélectionner',
 'حذف': 'Supprimer', 'حفظ': 'Enregistrer', 'إلغاء': 'Annuler', 'رجوع': 'Retour', 'معاينة': 'Aperçu', 'نسخ': 'Copier', 'تم': 'Terminé', 'تفعيل': 'Activer', 'إيقاف': 'Désactiver', 'مفعّل': 'Activé', 'نشط': 'Actif', 'الكل': 'Tous', 'لا توجد نتائج': 'Aucun résultat', 'حفظ الإعدادات': 'Enregistrer les réglages', 'حفظ التغييرات': 'Enregistrer les modifications', 'تراجع': 'Annuler', '↩ تراجع': '↩ Annuler', 'إرسال': 'Envoyer', 'حفظ الكل': 'Tout enregistrer', 'حفظ ونشر': 'Enregistrer et publier', 'إعدادات': 'Réglages', 'الإعدادات': 'Réglages',
 'البريد الإلكتروني': 'E-mail', 'كلمة المرور': 'Mot de passe', 'رقم الهاتف': 'Numéro de téléphone', 'السبب (اختياري)': 'Motif (facultatif)', 'اسم المنتج': 'Nom du produit', 'السعر': 'Prix', 'السعر القديم': 'Ancien prix', 'التصنيف': 'Catégorie', 'الوسوم': 'Étiquettes', 'المخزون ': 'Stock', 'العنوان': 'Titre', 'الفترة': 'Période',
 # الحالات والقوائم
 'جديدة': 'Nouvelle', 'مؤكَّدة': 'Confirmée', 'مُرسَلة': 'Envoyée', 'مُسلَّمة': 'Livrée', 'في انتظار التأكيد ': 'En attente', 'مرتجعة': 'Retournée', 'فشل/مرتجع': 'Échec/retour', 'ملغاة ': 'Annulée', 'تم الإرسال للشركة': 'Envoyé au transporteur',
 '🆕 جديد — في انتظار التأكيد': '🆕 Nouveau — en attente de confirmation', 'مؤكَّد — لم يُرسل للشركة': 'Confirmé — non envoyé au transporteur', 'في الطريق (بانتظار الشركة)': 'En route (en attente du transporteur)', 'تم التسليم (بانتظار الشركة)': 'Livré (en attente du transporteur)', 'ملغاة / فشل (بانتظار الشركة)': 'Annulé / échec (en attente du transporteur)',
 # الأرشيف والتحقق والمحظورون
 'قبل الإرسال': "Avant l'envoi", 'المرسلة': 'Envoyées', 'كل الأيام': 'Tous les jours', 'الكل (': 'Tous (', 'دخلت من الموقع': 'Venues du site', 'أدخلتُها يدوياً': 'Saisies manuellement', 'المنتجات كما أُرسلت': 'Produits tels qu’envoyés', 'ما سيصل الشركة': 'Ce que recevra le transporteur',
 'الهاتف': 'Téléphone', 'تحقق': 'Vérifier', 'بحث مباشر في WeCan أيضاً': 'Recherche directe aussi dans WeCan', 'توسيع: طرود ياليدين المقنَّعة المحتملة': 'Élargir : colis Yalidine masqués possibles', 'النتائج': 'Résultats', 'من تاريخ': 'À partir du', 'إلى تاريخ': "Jusqu'au", 'كل المنتجات': 'Tous les produits', 'حالة الطلب': 'Statut de la commande', 'كل الحالات ': 'Tous les statuts', 'الشركة / التتبع': 'Transporteur / suivi', 'الولاية / البلدية': 'Wilaya / commune',
 'سجل المرتجعات': 'Registre des retours', 'المحظورون': 'Bloqués', 'الزبون ': 'Client', 'المستوى': 'Niveau', 'الإرجاعات': 'Retours', 'آخر طلب فاشل': 'Dernière commande en échec', 'زبون سليم': 'Client fiable', 'مرتجع واحد': '1 retour', 'مرتجعان': '2 retours', 'إخفاء': 'Masquer', 'إضافة يدوية': 'Ajout manuel', 'إضافة للقائمة السوداء': 'Ajouter à la liste noire', 'القائمة السوداء لأرقام الهواتف': 'Liste noire des numéros de téléphone',
 # عملاء ومالية
 'عميل': 'Client', 'العميل': 'Client', 'مسلّمة': 'Livrées', 'الإنفاق': 'Dépenses', 'آخر طلب': 'Dernière commande', 'الشريحة': 'Segment', 'الأعلى إنفاقاً': 'Plus dépensiers', 'الأكثر طلباً': 'Plus de commandes', 'الأحدث طلباً': 'Plus récents', 'متكرر': 'Récurrent', 'خامل': 'Inactif', 'مخاطرة': 'À risque',
 'التكاليف والمصاريف': 'Coûts et frais', 'الحملة الإعلانية': 'Campagne publicitaire', 'سعر الشراء': "Prix d'achat", 'ربح القطعة': 'Profit par pièce', 'الزيارات': 'Visites', 'الأكثر مبيعاً': 'Meilleures ventes', 'توزيع الطلبات حسب الولاية': 'Répartition des commandes par wilaya',
 'نسخة احتياطية': 'Sauvegarde', 'مواقعي': 'Mes sites', 'الحالي': 'Actuel', 'اسم الموقع': 'Nom du site', 'عنوان الموقع': 'Adresse du site', 'نوع المتجر': 'Type de boutique', 'طلبات الدعم': 'Demandes de support', 'إرسال إلى الدعم': 'Envoyer au support', 'اللون الأساسي': 'Couleur principale', 'حجم الخط': 'Taille de police', 'صغير': 'Petit', 'كبير': 'Grand', 'المظهر داكن': 'Thème sombre', 'المظهر فاتح': 'Thème clair',
 'واتساب': 'WhatsApp', 'الألوان': 'Couleurs', 'الشعار (Logo)': 'Logo', 'اسم الوكيل': "Nom de l'agent", 'الصفحة': 'Page', 'منتج جديد': 'Nouveau produit', 'المعلومات الأساسية': 'Informations de base', 'حالة المنتج': 'Statut du produit', 'الكمية في المخزون': 'Quantité en stock', 'العروض والأسعار': 'Offres et prix',
 'تعديل المنتجات جماعياً': 'Modification des produits en masse', 'استيراد CSV': 'Importer CSV', 'معاينة قبل/بعد': 'Aperçu avant/après', 'نشر المخزون على الموقع الآن': 'Publier le stock sur le site maintenant', 'إضافة وسم': 'Ajouter une étiquette', 'إزالة وسم': 'Retirer une étiquette', 'نقل إلى تصنيف': 'Déplacer vers une catégorie', 'زيادة السعر بنسبة': 'Augmenter le prix en %', 'خفض السعر بنسبة': 'Baisser le prix en %', 'زيادة السعر بمبلغ': 'Augmenter le prix (montant)', 'خفض السعر بمبلغ': 'Baisser le prix (montant)', 'لا توجد منتجات': 'Aucun produit',
 'إضافة طلب جديد ': 'Ajouter une commande', 'إعداد شركة التوصيل': 'Réglage du transporteur', 'فحص الشركة': 'Tester le transporteur', 'حذف الشركة': 'Supprimer le transporteur', 'حفظ الشركة': 'Enregistrer le transporteur', '+ شركة توصيل جديدة': '+ Nouveau transporteur', 'رسوم التوصيل لكل ولاية': 'Frais de livraison par wilaya', 'إرسال التالي': 'Envoyer le suivant', 'مسح الكل': 'Tout effacer',
 'كود خصم جديد': 'Nouveau code promo', '+ كود جديد': '+ Nouveau code', 'نسبة مئوية %': 'Pourcentage %', 'توصيل مجاني 🚚': 'Livraison gratuite 🚚', 'منتج هدية 🎁': 'Produit cadeau 🎁',
 'تحديث الموقع': 'Mettre à jour le site', 'تحديث الآن': 'Actualiser maintenant', '↩ تراجع عن آخر تحديث': '↩ Annuler la dernière mise à jour',
}

PAIRS.update({
 'يؤكّد الطلبات الجديدة من المحدَّد دفعة واحدة، ويرسلها لشركة التوصيل إن كان الإرسال التلقائي مفعّلاً': 'Confirme d\'un coup les nouvelles commandes de la sélection et les envoie au transporteur si l\'envoi automatique est activé',
 'يرسل الطلبات المؤكَّدة غير المرسَلة من المحدَّد إلى شركة التوصيل بالتتابع': 'Envoie à la suite, au transporteur, les commandes confirmées non encore expédiées de la sélection',
 'يحدّد كل الطلبات المطابقة للبحث والفلاتر وليس صفحة واحدة فقط': 'Sélectionne toutes les commandes correspondant à la recherche et aux filtres, pas seulement la page affichée',
})

PATTERNS = [
 [r'^([\d\s.,]+)\s*دج$', r'\1 DA'],
 [r'^الطلبات الجديدة \((\d+)\)$', r'Nouvelles commandes (\1)'],
 [r'^قبل الإرسال \((\d+)\)$', r"Avant l'envoi (\1)"],
 [r'^محدَّد: (\d+)$', r'Sélection : \1'],
 [r'^(\d+) طلب$', r'\1 commande(s)'],
 [r'^(\d+)% من (\d+) مؤكَّدة$', r'\1 % sur \2 confirmées'],
 [r'^آخر (\d+) يوماً · (\d+) طلب أُنشئ$', r'\1 derniers jours · \2 commandes créées'],
 [r'^آخر (\d+) يوماً$', r'\1 derniers jours'],
 [r'^المنتجات \((\d+)\)$', r'Produits (\1)'],
 [r'^الطلبات \((\d+)\)$', r'Commandes (\1)'],
 [r'^اليوم \((\d+)\)$', r"Aujourd'hui (\1)"],
 [r'^كل الأيام \((\d+)\)$', r'Tous les jours (\1)'],
 [r'^الكل \((\d+)\)$', r'Tous (\1)'],
 [r'^دخلت من الموقع \((\d+)\)$', r'Venues du site (\1)'],
 [r'^أدخلتُها يدوياً \((\d+)\)$', r'Saisies manuellement (\1)'],
 [r'^النتائج (\d+)$', r'Résultats \1'],
 [r'^تم التسليم (\d+)$', r'Livrées \1'],
 [r'^فشل/مرتجع (\d+)$', r'Échecs/retours \1'],
 [r'^ملغاة (\d+)$', r'Annulées \1'],
 [r'^قيد المعالجة (\d+)$', r'En cours \1'],
 [r'^(\d+) تغيير غير محفوظ$', r'\1 modification(s) non enregistrée(s)'],
 [r'^(\d+) من (\d+) طلب$', r'\1 sur \2 commandes'],
 [r'^(\d+) نوفمبر$', r'\1 nov.'], [r'^(\d+) أكتوبر$', r'\1 oct.'], [r'^(\d+) ديسمبر$', r'\1 déc.'],
 [r'^مساء الخير، لوحة (.+)$', r'Bonsoir, tableau de bord \1'], [r'^صباح الخير، لوحة (.+)$', r'Bonjour, tableau de bord \1'], [r'^مرحباً، لوحة (.+)$', r'Bonjour, tableau de bord \1'],
 [r'^(\d+) ك$', r'\1 k'],
]

PAIRS.update({
 'أليسوم': 'ALYSSUM',
 'نظرة عامة على متجرك ومبيعاتك — تُحسب من طلباتك الحالية.': 'Vue d’ensemble de votre boutique et de vos ventes — calculée à partir de vos commandes actuelles.',
 'الطلبات المرسَلة اليوم إلى شركات التوصيل': "Commandes envoyées aujourd'hui aux transporteurs",
 'أعلى 8 بالطلبات · كل التواريخ': 'Top 8 par commandes · toutes dates',
 'النسبة من الطلبات المنتهية (سُلّمت أو رجعت)؛ «—» لا طلب منتهياً بعد.': 'Pourcentage des commandes terminées (livrées ou retournées) ; « — » : aucune commande terminée.',
 'طلب': 'commande', 'حملة نشطة مخزونها يكفي 5 أيام أو أقل': 'campagne active dont le stock couvre 5 jours ou moins', 'طلب مرتبط (عرض بعد الشراء) ينتظر الدمج': 'commande liée (offre après achat) en attente de fusion',
 'لم تُفعَّل شركة توصيل بعد': "Aucun transporteur activé pour l'instant", 'لتُرسَل الطلبات المؤكَّدة تلقائياً وتتبّع حالتها الحقيقية يجب تفعيل': "Pour envoyer automatiquement les commandes confirmées et suivre leur statut réel, activez", 'وإدخال API ID وAPI Token من حسابك لديهم.': 'et saisissez votre API ID et API Token depuis votre compte chez eux.', 'تفعيل شركة التوصيل الآن': 'Activer le transporteur maintenant',
 'ملف CSV (يفتح في Google Sheets/Excel)': 'Fichier CSV (s’ouvre dans Google Sheets/Excel)', 'الزبون / الولاية': 'Client / wilaya', 'الموقع': 'Site', 'رابط': 'Lien',
 '☎️ نتيجة الاتصال…': '☎️ Résultat de l’appel…', '✅ أكّد الطلب': '✅ Confirmer la commande', '📞 لم يُجب — محاولة 1': '📞 Sans réponse — essai 1', '📞 لم يُجب — محاولة 2': '📞 Sans réponse — essai 2', '📞 لم يُجب — محاولة 3': '📞 Sans réponse — essai 3', '⏰ أعد الاتصال لاحقاً': '⏰ Rappeler plus tard', '📅 مؤجَّل إلى الغد': '📅 Reporté à demain', '📵 رقم خاطئ / خارج الخدمة': '📵 Faux numéro / hors service', '❌ ألغى الطلب': '❌ A annulé la commande',
 'تسجيل الطلبات الجديدة تلقائياً لدى شركة التوصيل دون انتظار التأكيد (اختياري)': "Enregistrer automatiquement les nouvelles commandes chez le transporteur sans attendre la confirmation (facultatif)",
 'إرسال الطلب المؤكَّد تلقائياً إلى شركة التوصيل ونقله إلى «الطلبات المسجلة»': 'Envoyer automatiquement la commande confirmée au transporteur et la déplacer vers « Commandes enregistrées »',
 'حذف الطلب الملغى تلقائياً (إن لم يكن مرسَلاً لشركة التوصيل)': "Supprimer automatiquement la commande annulée (si non envoyée au transporteur)",
 'أرشيف الطلبات: الطلبات كلها، والتجهيز (المؤكَّدة غير المرسَلة)، والمرسلة — لا يختفي منها طلب': "Archive : toutes les commandes, préparation (confirmées non envoyées) et envoyées — aucune commande ne disparaît",
 'إضافة طلب يدوياً (هاتف، واتساب…) ليظهر كباقي الطلبات': 'Ajouter une commande manuellement (téléphone, WhatsApp…) pour qu’elle apparaisse comme les autres',
 'بحث بالاسم أو الهاتف أو رقم الطلب...': 'Rechercher par nom, téléphone ou n° de commande…', 'زبائن تركوا رقمهم ولم يُكملوا الطلب': 'Clients ayant laissé leur numéro sans finaliser la commande',
 'الطلبات المحذوفة: إعادة إدراج أو حذف نهائي أو تفريغ السلة': 'Commandes supprimées : rétablir, supprimer définitivement ou vider la corbeille', 'ينسخ طلباتك القديمة إلى متجرك مرة واحدة (بدون تكرار)': 'Copie vos anciennes commandes dans votre boutique une seule fois (sans doublons)',
 'مصدر الطلب': 'Source de la commande', 'يجلب حالة كل طرد مرسَل إلى شركة التوصيل ويحدّث حالات الطلبات': 'Récupère le statut de chaque colis envoyé et met à jour les commandes', 'يحفظ البحث والفلاتر الحالية كعرض باسم تختاره': 'Enregistre la recherche et les filtres actuels sous un nom',
 'تحديد كل طلبات هذه الصفحة': 'Sélectionner toutes les commandes de cette page', 'طلب جاء من الموقع': 'Commande venue du site', 'جاء من رابط مباشر بلا حملة': 'Venu d’un lien direct sans campagne', 'نتيجة الاتصال بالزبون وإجراءات الطلب': 'Résultat de l’appel client et actions sur la commande', 'معاينة الطلب': 'Aperçu de la commande',
 'الفترة الحالية من البداية': 'Période actuelle depuis le début', 'الأرشيف · بداية جديدة': 'Archive · nouveau départ', 'تعريفة WeCan لولاية': 'Tarif WeCan pour une wilaya', 'طرود حسابك في ياليدين': 'Colis de votre compte Yalidine', 'لم تُحمَّل بعد': 'Pas encore chargés', 'تحميل / تحديث الطرود': 'Charger / actualiser les colis',
 'كل الطرود المعروضة': 'Tous les colis affichés', 'نسخ إلى Google Sheets': 'Copier vers Google Sheets', 'طباعة المحدد': 'Imprimer la sélection', 'طباعة المحدَّد (A4 أو A6)': 'Imprimer la sélection (A4 ou A6)', 'طباعة الكل (A4 أو A6)': 'Tout imprimer (A4 ou A6)', 'إدارة': 'Gérer', 'إزالة ربط المحدد (تعود «غير مرسَلة»)': 'Retirer le lien de la sélection (redevient « non envoyée »)', 'الاسم واللقب': 'Nom et prénom', 'عند الشركة': 'Chez le transporteur',
 'بحث بالتتبع أو الاسم أو الهاتف أو رقم الطلب...': 'Rechercher par suivi, nom, téléphone ou n° de commande…', 'تصفية بشركة التوصيل': 'Filtrer par transporteur', 'الطلبات التي أُرسلت اليوم إلى شركات التوصيل (وأرشيف الأيام السابقة)': "Commandes envoyées aujourd'hui aux transporteurs (et archive des jours précédents)",
 'يحدّث حالات الطرود ويعيد تحميل طرود الشركة المعروضة': 'Met à jour les statuts des colis et recharge ceux du transporteur affiché', 'ينزّل نسخة (ملف CSV يفتح في Excel) من الطلبات المسجلة المعروضة حسب البحث والفلاتر الحالية': 'Télécharge une copie (CSV pour Excel) des commandes enregistrées affichées selon la recherche et les filtres',
 'قائمة بالمنتج والكمية والولاية والتتبع مع طباعة PDF': 'Liste produit, quantité, wilaya et suivi avec impression PDF', 'معاينة الطلب: تعديل وحذف وطباعة': 'Aperçu de la commande : modifier, supprimer et imprimer', 'تعديل البيانات (يتحدّث الطرد لدى الشركة)': 'Modifier les données (le colis est mis à jour chez le transporteur)',
 'لحماية متجرك من الطلبات الوهمية أو المتكررة في الإلغاء والإرجاع.': 'Protège votre boutique des fausses commandes ou des commandes répétées en annulation et retour.', 'سجل المرتجعات — كل زبون فشل توصيل طلبه ورجع': 'Registre des retours — chaque client dont la commande a échoué et est revenue',
 'برتقالي مرّة واحدة ·': 'orange : une fois ·', 'برتقالي غامق مرّتان ·': 'orange foncé : deux fois ·', 'أخضر في الطلبات.': 'vert dans les commandes.',
 'تعذّر تحميل الطلبات: no_backend': 'Impossible de charger les commandes : no_backend', 'إعادة المحاولة': 'Réessayer',
 'الطرود الراجعة من شركة التوصيل بحالتها عندها، وتسجيل اختياري لاستبدال بعد التسليم': 'Colis retournés par le transporteur avec leur statut, et enregistrement facultatif d’un échange après livraison', 'مهلة الإرجاع بالأيام': 'Délai de retour en jours', 'تسجيل استبدال بعد التسليم': 'Enregistrer un échange après livraison', 'طرود راجعة': 'Colis retournés', 'نسبة الطلبات المرتجعة': 'Taux de commandes retournées', 'أكثر المنتجات إرجاعاً': 'Produits les plus retournés', 'عدّاد الإرجاعات والحظر': 'Compteur de retours et blocage', 'إعدادات الحظر': 'Réglages du blocage',
 'طرود راجعة (حسب حالة شركة التوصيل)': 'Colis retournés (selon le statut du transporteur)', 'الطلب': 'Commande', 'حالة الرجوع': 'État du retour', 'الانتظار عند الشركة': 'Attente chez le transporteur', 'لا طرود راجعة حالياً.': 'Aucun colis en retour pour le moment.', 'سجلّ استبدال/إرجاع بعد التسليم (يدوي)': 'Journal d’échanges/retours après livraison (manuel)', 'سجلّ العمليات': 'Journal des opérations', 'النوع / السبب': 'Type / motif', 'المبلغ / الفرق': 'Montant / écart', 'إعادة المخزون': 'Remise en stock', 'لا توجد مرتجعات مسجّلة بعد.': 'Aucun retour enregistré pour l’instant.',
 'حد VIP': 'Seuil VIP', 'نسخ أرقام الشريحة': 'Copier les numéros du segment', 'الشرائح المخصّصة': 'Segments personnalisés',
})
PATTERNS += [
 [r'^في انتظار التأكيد: (\d+)$', r'En attente de confirmation : \1'], [r'^قيد التجهيز: (\d+)$', r'En préparation : \1'], [r'^في الطريق: (\d+)$', r'En route : \1'], [r'^تم التسليم: (\d+)$', r'Livrées : \1'], [r'^ملغاة / فشل: (\d+)$', r'Annulées / échec : \1'],
 [r'^(\d+) قطعة$', r'\1 pièces'], [r'^(\d+) من أصل (\d+) \(بعد الفلترة\)$', r'\1 sur \2 (après filtrage)'], [r'^طباعة \((\d+)\)$', r'Imprimer (\1)'],
 [r'^عدد الإرجاعات: (\d+) — آخرها (.+)$', r'Nombre de retours : \1 — dernier le \2'], [r'^(\d+) عميل حسب رقم الهاتف$', r'\1 client(s) par numéro de téléphone'],
 [r'^(\d+)ك$', r'\1 k'],
]

PAIRS.update({
 'اضغط «': 'Cliquez sur «',
 'تحديث الحالة» أعلاه لعرض إحصاءات حسابك في ياليدين حسب الحالة.': 'Actualiser le statut» ci-dessus pour afficher les statistiques de votre compte Yalidine par statut.',
 'أخضر ثم برتقالي ثم أحمر = حظر. الحظر التلقائي: مطفأ': 'Vert puis orange puis rouge = blocage. Blocage automatique : désactivé',
})
PATTERNS += [
 [r'^أخضر ثم برتقالي ثم أحمر = حظر\. الحظر التلقائي: مفعّل عند (\d+) إرجاعات \(حظر مباشر\)$', r'Vert puis orange puis rouge = blocage. Blocage automatique : activé dès \1 retours (blocage direct)'],
 [r'^أخضر ثم برتقالي ثم أحمر = حظر\. الحظر التلقائي: مفعّل عند (\d+) إرجاعات \(بانتظار مراجعتك\)$', r'Vert puis orange puis rouge = blocage. Blocage automatique : activé dès \1 retours (en attente de votre examen)'],
]

MONTHS = {'يناير': 'janv.', 'جانفي': 'janv.', 'فبراير': 'févr.', 'فيفري': 'févr.', 'مارس': 'mars', 'أبريل': 'avr.', 'أفريل': 'avr.', 'مايو': 'mai', 'ماي': 'mai', 'يونيو': 'juin', 'جوان': 'juin', 'يوليو': 'juil.', 'جويلية': 'juil.', 'أغسطس': 'août', 'أوت': 'août', 'سبتمبر': 'sept.', 'أكتوبر': 'oct.', 'نوفمبر': 'nov.', 'ديسمبر': 'déc.'}
for _a, _f in MONTHS.items():
    PATTERNS += [[r'^(\d+) ' + _a + r': ([\d\s.,]+) دج$', r'\1 ' + _f + r' : \2 DA'], [r'^(\d+) ' + _a + r'$', r'\1 ' + _f]]
MISS = os.path.join(ROOT, 'scripts', 'i18n-fr-miss.json')      # نصوص التقطتها أداة الفحص (miss) وتُرجمت

PAIRS.update({
 'نص الرسالة': 'Texte du message', 'موثّقون فقط': 'Vérifiés uniquement', 'مفضلتي': 'Mes favoris', 'اشرح ما تحتاجه': 'Décrivez ce dont vous avez besoin',
 'Produits physiques (توصيل)': 'Produits physiques (livraison)', 'تفصيل Transporteur': 'Détail par transporteur', 'جديد vs période précédente': 'Nouveaux vs période précédente',
 'Page de destination ذكية': 'Page de destination intelligente', 'Taux de livraison لكل شركة Par zone': 'Taux de livraison par transporteur · par zone', 'Mots-clés للصفحة': 'Mots-clés de la page',
 'مثال: عسل حر، زبيب، جنكة، ريحان، لوز…': 'Exemple : miel pur, raisins secs, ginkgo, basilic, amandes…', 'الصق وصف منتجك ومميزاته: لمن هو، ما يميّزه، العروض…': 'Collez la description de votre produit et ses atouts : à qui il s\'adresse, ce qui le distingue, les offres…',
 'وصف SEO مخصص للصفحة الرئيسية — اتركه فارغاً لاستخدام الوصف الحالي': 'Description SEO personnalisée de la page d\'accueil — laissez vide pour garder la description actuelle',
 'جمل قصيرة مقنعة، يقرأها الأفاتار بالترتيب، وآخر جملة تدعو للطلب': 'Phrases courtes et convaincantes lues dans l\'ordre par l\'avatar ; la dernière invite à commander',
})

# شروح الأقسام من admin.html (النص العربي بالضبط) ← الفرنسي
navs = re.findall(r'<button class="nav-btn"[^>]*onclick="Admin\.tab\(\'([^\']+)\'[^>]*>.*?<b>(.*?)</b>(?:<span[^>]*>.*?</span>)?<small>(.*?)</small>', html, flags=re.S)
strip = lambda x: re.sub(r'<[^>]+>', '', x).strip()
for k, b, sm in navs:
    if k in NAV_FR:
        PAIRS.setdefault(strip(b), NAV_FR[k][0]); PAIRS.setdefault(strip(sm), NAV_FR[k][1])

FR = os.path.join(ROOT, 'scripts', 'i18n-fr-frags.json')       # شظايا مولَّدة (scripts/i18n-extract.py ← ترجمة) تحت الأزواج اليدوية
frags = json.load(open(FR, encoding='utf-8')) if os.path.exists(FR) else {}
frags.update(json.load(open(MISS, encoding='utf-8')) if os.path.exists(MISS) else {})
exact = dict(frags); exact.update({k.strip(): v for k, v in PAIRS.items()})
_RX = re.compile(r'(?<!technologie )(?<!technologie IA )\bAlyssum\b(?! (?:API|3D|Box|Mockup|Studio|Pack))')
exact = {k: _RX.sub('أليسوم', v) for k, v in exact.items()}      # اسم المتجر/القالب بالعربية: يحوّله المحرّك إلى اسم المتجر ويستبدله مولّد الحزمة باسم العميل
out = {'exact': exact, 'patterns': PATTERNS}
dst = os.path.join(ROOT, 'assets', 'data', 'i18n-fr.json')
json.dump(out, open(dst, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('exact:', len(out['exact']), 'patterns:', len(PATTERNS), '->', dst)
