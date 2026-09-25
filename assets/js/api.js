/* Alyssum — API layer */
const API = {
  async get(endpoint){
    if(!CONFIG.API_URL) return null;
    const res = await fetch(CONFIG.API_URL + "/" + endpoint);
    return res.json();
  },
  async post(endpoint, body){
    if(!CONFIG.API_URL) return null;
    const res = await fetch(CONFIG.API_URL + "/" + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  async saveProduct(key, product){
    return this.post("admin/products", { key, ...product });
  },
  async deleteProduct(key, slug){
    return this.post("admin/products/delete", { key, slug });
  },
  async saveCategories(key, categories){
    return this.post("admin/categories", { key, categories });
  },
  async saveFees(key, fees){
    return this.post("admin/fees", { key, fees });
  },
  async orders(key){
    return this.get("admin/orders?key=" + key);
  },
  async updateOrder(key, id, status){
    return this.post("admin/orders/update", { key, id, status });
  },

  /* ════════ GitHub API لحفظ صفحات المنتجات ════════ */
  async savePageToGitHub(slug, html){
    const owner = "saberbalbouzi-ui";
    const repo = "alyssumdz";
    const path = `p/${slug}/index.html`;

    try {
      // جلب SHA الملف الحالي إن وجد
      let sha = null;
      const getRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
      if(getRes.ok){
        const data = await getRes.json();
        sha = data.sha;
      }

      // تشفير HTML إلى Base64
      const encoder = new TextEncoder();
      const bytes = encoder.encode(html);
      let binary = "";
      bytes.forEach(b => binary += String.fromCharCode(b));
      const contentBase64 = btoa(binary);

      // حفظ الملف
      const saveRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: "PUT",
        headers: {
          "Authorization": "token " + CONFIG.GITHUB_TOKEN,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `feat: تحديث صفحة المنتج ${slug}`,
          content: contentBase64,
          ...(sha ? { sha } : {})
        })
      });

      if(!saveRes.ok){
        const err = await saveRes.json();
        throw new Error(err.message || "فشل الحفظ في GitHub");
      }

      return { ok: true, path };
    } catch(err){
      console.error("خطأ GitHub API:", err);
      return { ok: false, error: err.message };
    }
  }
};
