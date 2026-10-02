$(function () {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const read = key => { try { const a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
    let products = read('products'), boms = [];
    const selected = new Set();
    const size = b => b.size || ProductCodes.sizes[String(b.brand || '').toUpperCase()] || '';
    const code = b => ProductCodes.generate(b.brand, b.designNumber || b.description, b.color, size(b));
    const photo = b => b.photo ? '<img src="' + esc(b.photo) + '" alt="Product" style="width:60px;height:60px;object-fit:cover;border-radius:7px">' : '<span class="text-muted">No Photo</span>';
    function cells(b, showBarcode = true) { return '<td>' + esc(b.brand) + '</td><td>' + esc(b.designNumber || b.description) + '</td><td>' + esc(b.color) + '</td><td>' + photo(b) + '</td><td>' + esc(b.pieceCount || b.pieces?.length || 1) + ' Pic</td><td>' + esc(size(b)) + '</td>' + (showBarcode ? '<td>' + esc(b.barcode || code(b)) + '<div class="product-qr mt-2" data-code="' + esc(b.barcode || code(b)) + '"></div></td>' : ''); }
    function renderQr(root) {
        if (typeof QRCode !== 'function') return;
        $(root).find('.product-qr').each(function () {
            const value = this.dataset.code;
            if (value) new QRCode(this, {text:value,width:72,height:72});
        });
    }
    function render() {
        const q = String($('#searchInput').val() || '').trim().toLowerCase();
        const rows = products.filter(b => [b.brand,b.designNumber,b.description,b.color,b.barcode].join(' ').toLowerCase().includes(q));
        $('#productTableBody').html(rows.map(b => '<tr>' + cells(b, false) + '<td><div class="d-flex gap-1"><a class="btn btn-sm btn-success" href="product-form?id=' + encodeURIComponent(b.id) + '" title="Edit"><i class="bx bx-edit"></i></a><button type="button" class="btn btn-sm btn-info barcode-product" data-id="' + esc(b.id) + '" title="Barcode" aria-label="Show barcode"><i class="bx bx-barcode"></i></button><button type="button" class="btn btn-sm btn-danger delete-product" data-id="' + esc(b.id) + '" title="Delete" aria-label="Delete product"><i class="bx bx-trash"></i></button></div></td></tr>').join('') || '<tr><td colspan="7" class="text-center text-muted py-4">No products found</td></tr>');
        renderQr('#productTableBody');
    }
    function alreadyImported(b) {
        const current = read('products');
        const design = String(b.designNumber || '').trim().toLowerCase();
        return read('productBomImportHistory').includes(String(b.id)) || current.some(p =>
            String(p.bomId ?? '') === String(b.id) ||
            String(p.sourceDesignNumber || p.designNumber || p.description || '').trim().toLowerCase() === design
        );
    }
    function visible() { const q = String($('#bomSearch').val() || '').trim().toLowerCase(); return boms.filter(b => !alreadyImported(b) && [b.designNumber,b.brand,b.color].join(' ').toLowerCase().includes(q)); }
    function renderBoms() {
        const rows = visible(), count = rows.filter(b => selected.has(b)).length;
        $('#bomImportBody').html(rows.map(b => '<tr><td><input type="checkbox" class="bom-select" data-index="' + boms.indexOf(b) + '" aria-label="Select design" ' + (selected.has(b) ? 'checked' : '') + '></td>' + cells({...b,barcode:code(b)}) + '</tr>').join('') || '<tr><td colspan="8" class="text-center">No BOM records found</td></tr>');
        renderQr('#bomImportBody');
        $('#bomSelectAll').prop('checked', rows.length > 0 && count === rows.length).prop('indeterminate', count > 0 && count < rows.length);
        $('#bomSelectionCount').text(selected.size + ' selected. Barcodes are generated automatically.');
    }
    function persist(updates) {
        const before = Object.fromEntries(Object.keys(updates).map(key => [key, localStorage.getItem(key)]));
        try { Object.entries(updates).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value))); }
        catch (error) { Object.entries(before).forEach(([key, value]) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value)); throw error; }
    }
    $('#productTableBody').on('click', '.barcode-product', function () {
        const p = read('products').find(p => String(p.id) === this.dataset.id);
        if (!p) return;
        const value = p.barcode || code(p);
        $('#productBarcodeText').text(value); $('#productBarcodePreview').empty(); $('#productBarcodeQr').empty();
        if (!value) { Swal.fire('Warning!', 'Product barcode is not available.', 'warning'); return; }
        if (typeof JsBarcode === 'function') { try { JsBarcode('#productBarcodePreview', value, {format:'CODE128',height:55,fontSize:12}); } catch (_) {} }
        if (typeof QRCode === 'function') new QRCode(document.getElementById('productBarcodeQr'), {text:value,width:180,height:180});
        $('#productBarcodeModal').modal('show');
    });
    $('#productTableBody').on('click', '.delete-product', function () {
        const id = this.dataset.id;
        Swal.fire({title:'Delete product?',text:'This product will also disappear from BOM Master.',icon:'warning',showCancelButton:true,confirmButtonText:'Delete',confirmButtonColor:'#d33'}).then(result => {
            if (!result.isConfirmed) return;
            const current = read('products'), p = current.find(p => String(p.id) === id);
            if (!p) return;
            const linked = p.bomId !== null && p.bomId !== undefined;
            const source = linked ? String(p.bomId) : null;
            const updates = {products:current.filter(p => String(p.id) !== id)};
            if (linked) {
                updates.productBomImportHistory = [...new Set([...read('productBomImportHistory'), source])];
                updates.productDeletedBomIds = [...new Set([...read('productDeletedBomIds'), source])];
            }
            try { persist(updates); } catch (_) { Swal.fire('Error!', 'Product could not be deleted.', 'error'); return; }
            products = updates.products; render(); renderBoms(); Swal.fire('Deleted!', 'Product deleted successfully.', 'success');
        });
    });
    $('#searchInput').on('input', render);
    $('#importBomBtn').on('click', () => { boms = read('bomMasterData'); selected.clear(); $('#bomSearch').val(''); renderBoms(); $('#bomImportModal').modal('show'); });
    $('#bomSearch').on('input', renderBoms);
    $('#bomImportBody').on('change', '.bom-select', function () { const b = boms[Number(this.dataset.index)]; this.checked ? selected.add(b) : selected.delete(b); renderBoms(); });
    $('#bomSelectAll').on('change', function () { visible().forEach(b => this.checked ? selected.add(b) : selected.delete(b)); renderBoms(); });
    $('#saveBomImport').on('click', () => {
        if (!selected.size) { Swal.fire('Warning!', 'Select at least one BOM record.', 'warning'); return; }
        products = read('products');
        const used = new Set(products.map(b => String(b.barcode || '').toLowerCase()));
        const usedDesigns = new Set(products.map(b => String(b.designNumber || b.description || '').trim().toLowerCase()));
        const additions = []; let skipped = 0;
        for (const b of selected) {
            if (alreadyImported(b)) { skipped++; continue; }
            const barcode = code(b);
            if (!barcode) { Swal.fire('Warning!', 'Selected BOM records need brand, design number, color and size.', 'warning'); return; }
            const design = String(b.designNumber || '').trim().toLowerCase();
            if (usedDesigns.has(design) || used.has(barcode.toLowerCase())) { skipped++; continue; }
            used.add(barcode.toLowerCase());
            usedDesigns.add(design);
            additions.push({...JSON.parse(JSON.stringify(b)), id:'PRD' + Date.now() + '-' + additions.length, bomId:b.id, sourceDesignNumber:b.designNumber, description:b.designNumber, size:size(b), barcode});
        }
        const next = products.concat(additions);
        try { persist({ products: next, productBomImportHistory: [...new Set([...read('productBomImportHistory'), ...additions.map(p => String(p.bomId))])] }); } catch (_) { Swal.fire('Error!', 'Browser storage is full. Products could not be saved.', 'error'); return; }
        products = next; render(); $('#bomImportModal').modal('hide'); Swal.fire('Import Complete', additions.length + ' imported, ' + skipped + ' already exist.', additions.length ? 'success' : 'info');
    });
    window.addEventListener('storage', e => { if (['products', 'bomMasterData', 'productBomImportHistory', 'productDeletedBomIds'].includes(e.key)) { products = read('products'); boms = read('bomMasterData'); render(); renderBoms(); } });
    render();
});
