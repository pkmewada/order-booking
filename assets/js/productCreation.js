$(function () {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const read = key => { try { const a = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; } };
    let products = [], boms = [];
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
        $('#productTableBody').html(rows.map(b => '<tr>' + cells(b, false) + '<td><div class="d-flex gap-1"><a class="btn btn-sm btn-dark text-white" style="background-color:#000;border-color:#000;color:#fff;" href="product-form?id=' + encodeURIComponent(b.id) + '" title="Edit"><i class="bx bx-edit text-white"></i></a><button type="button" class="btn btn-sm btn-dark text-white barcode-product" style="background-color:#000;border-color:#000;color:#fff;" data-id="' + esc(b.id) + '" title="Barcode" aria-label="Show barcode"><i class="bx bx-barcode text-white"></i></button><button type="button" class="btn btn-sm btn-dark text-white delete-product" style="background-color:#000;border-color:#000;color:#fff;" data-id="' + esc(b.id) + '" title="Delete" aria-label="Delete product"><i class="bx bx-trash text-white"></i></button></div></td></tr>').join('') || '<tr><td colspan="7" class="text-center text-muted py-4">No products found</td></tr>');
        renderQr('#productTableBody');
    }
    function alreadyImported(b) { return b.inProductList || !b.bomCompleted || b.status !== 'active'; }
    function visible() { const q = String($('#bomSearch').val() || '').trim().toLowerCase(); return boms.filter(b => !alreadyImported(b) && [b.designNumber,b.brand,b.color].join(' ').toLowerCase().includes(q)); }
    function renderBoms() {
        const rows = visible(), count = rows.filter(b => selected.has(b)).length;
        $('#bomImportBody').html(rows.map(b => '<tr><td><input type="checkbox" class="bom-select" data-index="' + boms.indexOf(b) + '" aria-label="Select design" ' + (selected.has(b) ? 'checked' : '') + '></td>' + cells({...b,barcode:code(b)}) + '</tr>').join('') || '<tr><td colspan="8" class="text-center">No BOM records found</td></tr>');
        renderQr('#bomImportBody');
        $('#bomSelectAll').prop('checked', rows.length > 0 && count === rows.length).prop('indeterminate', count > 0 && count < rows.length);
        $('#bomSelectionCount').text(selected.size + ' selected. Barcodes are generated automatically.');
    }
    async function reload(){boms=await CatalogApi.load();products=boms.filter(r=>r.inProductList);render();renderBoms();}
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
    $('#productTableBody').on('click','.delete-product',async function(){const id=this.dataset.id;const result=await Swal.fire({title:'Delete product?',text:'This record and photo will also be removed from BOM Master.',icon:'warning',showCancelButton:true});if(!result.isConfirmed)return;try{await CatalogApi.request('product',{id},null,'DELETE');await reload();Swal.fire('Deleted!','Product deleted successfully.','success');}catch(e){Swal.fire('Unable to delete',e.message,'error');}});
    $('#searchInput').on('input', render);
    $('#importBomBtn').on('click',async()=>{try{await reload();selected.clear();$('#bomSearch').val('');renderBoms();$('#bomImportModal').modal('show');}catch(e){Swal.fire('Unable to load',e.message,'error');}});
    $('#bomSearch').on('input', renderBoms);
    $('#bomImportBody').on('change', '.bom-select', function () { const b = boms[Number(this.dataset.index)]; this.checked ? selected.add(b) : selected.delete(b); renderBoms(); });
    $('#bomSelectAll').on('change', function () { visible().forEach(b => this.checked ? selected.add(b) : selected.delete(b)); renderBoms(); });
    $('#saveBomImport').on('click',async function(){if(!selected.size){Swal.fire('Warning!','Select at least one BOM record.','warning');return;}const button=$(this);if(button.prop('disabled'))return;button.prop('disabled',true);try{await CatalogApi.request('product',{action:'import',ids:[...selected].map(r=>r.id)});await reload();selected.clear();$('#bomImportModal').modal('hide');Swal.fire('Success!','BOM records imported.','success');}catch(e){Swal.fire('Unable to import',e.message,'error');}finally{button.prop('disabled',false);}});
    reload().catch(e=>Swal.fire('Unable to load',e.message,'error'));
});
