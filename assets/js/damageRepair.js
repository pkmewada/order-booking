(function () {
    'use strict';
    const body = document.getElementById('damageRows');
    const errorBox = document.getElementById('damageError');
    const escape = value => String(value ?? '-').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    function error(err) { errorBox.textContent = err.message; errorBox.classList.remove('d-none'); }
    function render() {
        try {
            errorBox.classList.add('d-none');
            const rows = Production.damageRepairs();
            body.innerHTML = rows.length ? rows.map(r => `<tr>${[r.batchId,r.subBatch || r.packingLotId,r.brand,r.designNumber,r.color,r.pieces,r.stage,r.worker,r.assignedQty,r.completedQty,r.passedQty,`${r.damageQty} ${r.unit}`,r.deliveryDate].map(v => `<td>${escape(v)}</td>`).join('')}<td><button class="btn btn-dark btn-sm" data-key="${escape(r.sourceKey)}" data-id="${escape(r.sourceWorkId)}">Reassign</button></td></tr>`).join('') : '<tr><td colspan="14" class="text-center">No outstanding damage.</td></tr>';
        } catch (err) { error(err); }
    }
    body.addEventListener('click', async event => {
        const button = event.target.closest('button[data-key]');
        if (!button || button.disabled) return;
        button.disabled = true;
        try { await Production.reassignDamage(button.dataset.key, button.dataset.id); render(); }
        catch (err) { error(err); button.disabled = false; }
    });
    window.addEventListener('storage', render);
    Production.initialize().then(render).catch(error);
})();
