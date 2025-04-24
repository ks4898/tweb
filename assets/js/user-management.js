document.addEventListener('DOMContentLoaded', function () {

    // get user information on page load
    fetch('/user-info')
        .then(response => response.json())
        .then(data => {
            document.getElementById("currentAdmin").innerHTML = (("Welcome, " + data.name) || 'N/A');
            document.getElementById("currentRole").innerHTML = ("You are " + data.role) || 'N/A';

        })
        .catch(error => {
            console.error('Error fetching user info:', error);
            document.getElementById("currentAdmin").innerHTML = 'Error';
            document.getElementById("currentRole").innerHTML = 'Error';
        });

    // session check on page load
    fetch('/check-session')
        .then(response => response.json())
        .then(data => {
            if (!data.loggedIn) {
                window.location.href = '/login';
            } else {
                fetchUsers();
                fetchRoles();
            }
        })
        .catch(error => {
            console.error('Error checking session:', error);
            window.location.href = '/login';
        });

    // event listener for Search button
    const searchButton = document.getElementById('searchButton');
    if (searchButton) {
        searchButton.addEventListener('click', function () {
            const searchTerm = document.getElementById('searchUser').value.trim();
            if (searchTerm) {
                searchUsers(searchTerm);
            } else {
                fetchUsers();
            }
        });
    }

    // event listener for Clear Search button
    const clearSearchButton = document.getElementById('clearSearchBtn');
    if (clearSearchButton) {
        clearSearchButton.addEventListener('click', function () {
            document.getElementById("searchUser").value = '';
            fetchUsers();
        });
    }

    document.getElementById('role').addEventListener('change', togglePlayerFields);
    document.getElementById('editRole').addEventListener('change', function() {
        toggleEditPlayerFields(this.value);
    });

    // event listener for Add User button to show modal
    const addUserButton = document.getElementById('addUserBtn');
    if (addUserButton) {
        addUserButton.addEventListener('click', function () {
            const userModal = new bootstrap.Modal(document.getElementById('userModal'));
            userModal.show();
        });
    }

    // event listener for Save User button in the modal
    const saveUserButton = document.getElementById('saveUserBtn');
    if (saveUserButton) {
        saveUserButton.addEventListener('click', function () {
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const role = document.getElementById('role').value;

            if (!firstName || !lastName || !email || !password || !role) {
                alert('Please fill in all fields.');
                return;
            }

            const userData = {
                firstName: firstName,
                lastName: lastName,
                email: email,
                password: password,
                role: role
            };

            if (role === 'Player') {
                userData.imageURL = document.getElementById('imageURL').value;
                userData.validStudent = document.getElementById('validStudent').value;
                userData.teamId = document.getElementById('teamId').value;
            }

            addUser(userData);
        });
    }

    document.getElementById('saveEditUserBtn').addEventListener('click', function(e) {
        e.preventDefault();
        const userId = document.getElementById('editUserId').value;
        updateUser(userId);
    });
});

// get available roles based on admin privileges for current user
async function fetchRoles() {
    try {
        const response = await fetch('/roles', {
            credentials: 'include'
        });

        if (response.status === 401) {
            window.location.href = '/login';
            return;
        }

        if (response.status === 403) {
            window.location.href = '/';
            return;
        }

        if (!response.ok) {
            throw new Error('Failed to fetch roles');
        }

        const roles = await response.json();
        populateRoleSelect(roles);
    } catch (error) {
        console.error('Error fetching roles:', error);
        alert('Failed to retrieve roles. Please try again.');
    }
}

// populate combobox with roles
function populateRoleSelect(roles) {
    const roleSelects = document.querySelectorAll('.form-select');

    roleSelects.forEach(select => {
        if (select.id == "role" || select.id == "editRole") {
            select.innerHTML = ''; // clear existing options

            roles.forEach(role => {
                const option = document.createElement('option');
                option.value = role;
                option.textContent = role;
                select.appendChild(option);
            });
        }
    });
}

// search users func
async function searchUsers(searchTerm) {
    try {
        const response = await fetch(`/users?search=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) {
            throw new Error('Failed to search users: ' + response.statusText);
        }
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error searching users:', error);
        alert('Failed to search users.');
    }
}

// fetch users from db func
async function fetchUsers() {
    try {
        const response = await fetch('/users');
        if (!response.ok) {
            throw new Error('Failed to fetch users: ' + response.statusText);
        }
        const users = await response.json();
        displayUsers(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        alert('Failed to fetch users.');
    }
}

// display users in table
function displayUsers(users) {
    const userTableBody = document.getElementById('userTableBody');
    userTableBody.innerHTML = '';

    fetch('/user-info')
        .then(response => response.json())
        .then(currentUser => {
            users.forEach(user => {
                let row = userTableBody.insertRow();
                let displayName = `${user.Name.length > 16 ? user.Name.substring(0, 16) + '...' : user.Name}`;
                let displayEmail = `${user.Email.length > 24 ? user.Email.substring(0, 24) + '...' : user.Email}`;
                row.insertCell().textContent = user.UserID;
                row.insertCell().textContent = displayName; 
                if (user.Role === "SuperAdmin" && currentUser.role !== "SuperAdmin") {
                    row.insertCell().textContent = "[REDACTED]"
                } else {
                    row.insertCell().textContent = displayEmail;
                }
                //row.insertCell().textContent = user.Email;
                row.insertCell().textContent = user.Role;

                let actionsCell = row.insertCell();
                if (user.Role !== "SuperAdmin" &&
                    user.UserID !== currentUser.userId &&
                    user.Role !== currentUser.role) {
                    actionsCell.innerHTML = `
                        <button onclick="editUser(${user.UserID})">Edit</button>
                        <button onclick="deleteUser(${user.UserID})">Delete</button>
                    `;
                } else {
                    actionsCell.innerHTML = "/";
                }
            });
        })
        .catch(error => {
            console.error('Error fetching current user info:', error);
        });
}

// add user func
async function addUser(userData) {
    try {
        const response = await fetch('/add-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        if (!response.ok) {
            throw new Error('Failed to add user: ' + response.statusText);
        }
        fetchUsers();
        const userModalEl = document.getElementById('userModal');
        const userModal = bootstrap.Modal.getInstance(userModalEl);
        if (userModal) {
            userModal.hide();
        } else {
            console.warn('Modal instance not found.');
        }
        alert('User added successfully!');
    } catch (error) {
        console.error('Error adding user:', error);
        alert('Failed to add user');
    }
}

// edit user func
async function editUser(userId) {
    try {
        const response = await fetch(`/user/${userId}`);
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        const user = await response.json();
        
        document.getElementById('editUserId').value = user.UserID;
        document.getElementById('editName').value = user.Name;
        document.getElementById('editEmail').value = user.Email;
        document.getElementById('editRole').value = user.Role;

        document.getElementById("editUserModalLabel").innerHTML = "Edit User with ID: " + userId;
        toggleEditPlayerFields(user.Role);
        if (user.Role === 'Player') {
            document.getElementById('editImageURL').value = user.ImageURL || '';
            document.getElementById('editValidStudent').value = user.ValidStudent ? '1' : '0';
            document.getElementById('editTeamId').value = user.TeamID || '';
        }
        
        const editUserModal = new bootstrap.Modal(document.getElementById('editUserModal'));
        editUserModal.show();
    } catch (error) {
        console.error('Error fetching user details:', error);
        alert('Failed to fetch user details');
    }
}

// save edited user func
async function updateUser(userId) {
    const name = document.getElementById('editName').value;
    const email = document.getElementById('editEmail').value;
    const role = document.getElementById('editRole').value;
    
    const userData = { name, email, role };

    if (role === 'Player') {
        userData.imageURL = document.getElementById('editImageURL').value;
        userData.validStudent = document.getElementById('editValidStudent').value;
        userData.teamId = document.getElementById('editTeamId').value;
    }

    try {
        const response = await fetch(`/edit-user/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            throw new Error('Failed to update user' + response);
        }
        const data = await response.json();
        alert("User updated successfully!");
        fetchUsers();
        const editUserModal = document.getElementById('editUserModal');
        const modalInstance = bootstrap.Modal.getInstance(editUserModal);
        modalInstance.hide();
    } catch (error) {
        console.error('Error updating user:', error);
        alert('Failed to update user');
    }
}

// delete user func
async function deleteUser(userId) {
    const deleteUserModal = new bootstrap.Modal(document.getElementById('deleteUserModal'));
    document.getElementById("userDetails").innerHTML = "Delete User ID: " + userId + " ?";
    deleteUserModal.show();

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

    confirmDeleteBtn.onclick = async function () {
        try {
            const response = await fetch(`/delete-user/${userId}`, { method: 'DELETE' });
            if (!response.ok) {
                throw new Error('Failed to delete user: ' + response.statusText);
            }
            fetchUsers();
            alert('User deleted successfully!');
            deleteUserModal.hide();
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Forbidden. The user has admin privileges or you are unauthorized');
        }
    }
}

// show/hide additional player creation fields
function togglePlayerFields() {
    const roleSelect = document.getElementById('role');
    const playerFields = document.getElementById('playerFields');
    if (roleSelect.value === 'Player') {
        playerFields.style.display = 'block';
    } else {
        playerFields.style.display = 'none';
    }
}

function toggleEditPlayerFields(role) {
    const playerFields = document.getElementById('editPlayerFields');
    playerFields.style.display = role === 'Player' ? 'block' : 'none';
}