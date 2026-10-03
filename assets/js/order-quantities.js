window.OrderQuantities = {
    perSet(item) {
        const brand = String(item.brand || '').toUpperCase().replace(/[^A-Z]/g, '');
        const counts = { NIVIBLOSSOM: 4, NIVIBLOSSOMA: 4, LITTLEDOLLY: 5, AMARI: 3 };
        return counts[brand] || Math.max(1, Math.floor(Number(item.piecesPerSet || item.pieceCount || item.pieces?.length) || 1));
    },
    sets(item) { return Math.max(0, Math.floor(Number(item.qty) || 0)); },
    pieces(item) { return this.sets(item) * this.perSet(item); },
    scanned(item) { return Math.min(this.pieces(item), Math.max(0, Math.floor(Number(item.dispatchScannedPieces) || 0))); },
    checked(item) { return this.pieces(item) > 0 && this.scanned(item) === this.pieces(item); },
    totals(order) {
        return (order.items || []).reduce((total, item) => ({sets: total.sets + this.sets(item), pieces: total.pieces + this.pieces(item)}), {sets: 0, pieces: 0});
    }
};
