// Users (sign-in accounts), admin only. All text from the server is escaped before it is shown.
$(function () {
    let users = [], me = null;
    const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

    async function request(data) {
        const response = await fetch('api/users.php', data
            ? { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
            : { cache: 'no-store' });
        let result;
        try { result = await response.json(); } catch (_) { throw new Error('Invalid server response. Check the database setup.'); }
        if (!response.ok || !result.success) throw new Error(result.message || 'Request failed.');
        return result.data;
    }

    async function load() {
        $('#userTableBody').html('<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>');
        try {
            const data = await request();
            users = data.users; me = data.me;
            render();
        } catch (error) {
            $('#userTableBody').html('<tr><td colspan="7" class="text-center py-4">Unable to load users.</td></tr>');
            Swal.fire({ title: 'Unable to load', text: error.message, icon: 'error' });
        }
    }

    function render() {
        const body = $('#userTableBody').empty();
        if (!users.length) {
            body.append('<tr><td colspan="7" class="text-center text-muted py-4">No users yet.</td></tr>');
            return;
        }
        users.forEach((user, index) => {
            const status = !user.active ? '<span class="badge bg-secondary">Disabled</span>'
                : user.locked ? '<span class="badge bg-warning">Locked</span>' : '<span class="badge bg-success">Active</span>';
            body.append(`<tr>
                <td>${index + 1}</td>
                <td><strong>${esc(user.username)}</strong>${user.id === me ? ' <span class="text-muted fs-12">(you)</span>' : ''}</td>
                <td>${esc(user.displayName)}</td>
                <td>${user.role === 'admin' ? 'Admin' : 'Employee'}</td>
                <td>${status}</td>
                <td>${esc(user.lastLoginAt || 'Never')}</td>
                <td class="text-center">
                    <button class="btn btn-sm btn-dark edit-user" data-id="${user.id}" title="Edit"><i class="bx bx-edit"></i></button>
                    <button class="btn btn-sm btn-dark reset-password" data-id="${user.id}" title="Reset password"><i class="bx bx-key"></i></button>
                </td></tr>`);
        });
    }

    $('#addUserBtn').on('click', function () {
        $('#userForm')[0].reset();
        $('#userId').val('');
        $('#userModalLabel').text('Add User');
        $('#userUsername').prop('disabled', false);
        $('#userPasswordGroup').show();
        $('#userActiveGroup').hide();
        $('#userModal').modal('show');
    });

    $('#userTableBody').on('click', '.edit-user', function () {
        const user = users.find(row => row.id === Number(this.dataset.id));
        if (!user) return;
        $('#userId').val(user.id);
        $('#userModalLabel').text('Edit User');
        $('#userUsername').val(user.username).prop('disabled', true);
        $('#userDisplayName').val(user.displayName);
        $('#userRole').val(user.role);
        $('#userActive').prop('checked', user.active);
        $('#userPasswordGroup').hide();
        $('#userActiveGroup').show();
        $('#userModal').modal('show');
    });

    $('#saveUserBtn').on('click', async function () {
        const button = $(this);
        if (button.prop('disabled')) return;
        const id = Number($('#userId').val());
        const data = id
            ? { action: 'update', id, displayName: $('#userDisplayName').val(), role: $('#userRole').val(), active: $('#userActive').prop('checked') }
            : { action: 'create', username: $('#userUsername').val().trim(), displayName: $('#userDisplayName').val(), role: $('#userRole').val(), password: $('#userPassword').val() };
        button.prop('disabled', true);
        try {
            await request(data);
            $('#userModal').modal('hide');
            Swal.fire({ title: 'Saved', text: id ? 'User updated.' : 'User created.', icon: 'success', timer: 1200, showConfirmButton: false });
            await load();
        } catch (error) {
            Swal.fire({ title: 'Not saved', text: error.message, icon: 'error' });
        } finally {
            button.prop('disabled', false);
        }
    });

    $('#userTableBody').on('click', '.reset-password', function () {
        const user = users.find(row => row.id === Number(this.dataset.id));
        if (!user) return;
        $('#passwordUserId').val(user.id);
        $('#passwordUserName').text(user.username);
        $('#newPassword').val('');
        $('#passwordModal').modal('show');
    });

    $('#savePasswordBtn').on('click', async function () {
        const button = $(this);
        if (button.prop('disabled')) return;
        button.prop('disabled', true);
        try {
            await request({ action: 'setPassword', id: Number($('#passwordUserId').val()), password: $('#newPassword').val() });
            $('#passwordModal').modal('hide');
            Swal.fire({ title: 'Password changed', text: 'The user must sign in again with the new password.', icon: 'success' });
            await load();
        } catch (error) {
            Swal.fire({ title: 'Not saved', text: error.message, icon: 'error' });
        } finally {
            button.prop('disabled', false);
        }
    });

    load();
});
