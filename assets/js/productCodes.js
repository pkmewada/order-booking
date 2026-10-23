window.ProductCodes = {
    sizes: { 'LITTLE DOLLY': '18-26', 'AMARI': 'S-L', 'NIVI BLOSSOM': '28-34' },
    generate(brand, design, color, size) {
        const prefix = { 'LITTLE DOLLY': 'Ld', 'AMARI': 'Am', 'NIVI BLOSSOM': 'Nv' }[String(brand || '').trim().toUpperCase()];
        const parts = [design, color, size].map(v => String(v || '').trim());
        return prefix && parts.every(Boolean) ? [prefix, ...parts].join('-') : '';
    }
};
