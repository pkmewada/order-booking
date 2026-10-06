<?php require_once __DIR__ . '/includes/header.php'; ?>
<div class="main-content app-content"><div class="container-fluid">
    <div class="my-4"><h4>Damage and Repair</h4></div>
    <div class="card custom-card"><div class="card-header"><div class="card-title">Outstanding Damage</div></div>
        <div class="card-body"><div id="damageError" class="alert alert-danger d-none" role="alert"></div>
            <div class="table-responsive"><table class="table table-bordered text-nowrap">
                <thead><tr><th>Batch</th><th>Sub Batch / Lot</th><th>Brand</th><th>Design</th><th>Color</th><th>Piece</th><th>Stage</th><th>Worker / Firm</th><th>Assigned</th><th>Completed</th><th>Passed</th><th>Damage</th><th>Delivery Date</th><th>Action</th></tr></thead>
                <tbody id="damageRows"></tbody>
            </table></div>
        </div>
    </div>
</div></div>
<?php require_once __DIR__ . '/includes/footer.php'; ?>
<script src="assets/js/production-engine.js"></script>
<script src="assets/js/damage-repair.js?v=<?= filemtime(__DIR__ . '/assets/js/damage-repair.js') ?>"></script>
</body></html>
