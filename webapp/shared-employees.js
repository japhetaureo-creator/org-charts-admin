// =============================================================================
// Shared Employee Data Store
// =============================================================================
// Single source of truth for employee data used by both
// Organization Chart and Employee Directory modules.
// Changes trigger onChange listeners so both UIs stay in sync.
// =============================================================================

const SharedEmployeeStore = (() => {
    // ── Unified employee data ────────────────────────────────────────────
    let employees = [
        {
            id: 'emp_001',
            name: 'James Wilson',
            email: 'james.wilson@acme.corp',
            department: 'Leadership',
            location: 'New York, USA',
            status: 'active',
            startDate: '2015-01-12',
            gender: 'Male',
            phone: '12125550101',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCH0PswGnzylr3WjMsYe5faxAo31vyAsh0Gi5--LlarGKQZvIIpt6qIlP0nDydMY34XOR1lLV8w_XBbWmk4ch9v5lxTHUzvNPKvUsGyFLMrwQlTPfGC0UzuHkP8I97DYcY0esRnC6HIsc8mB2G5Nn8Hz2yfF_aHvjgDHmhKplgML9zq3oyxa47A77r2KgWs92LvNzJ1DIMEVMcJQFV1vNyw-LALL_HAUDbVX7rx8q3PpTKW95t7ruOfEE2_SMeaoEPgNIzcCLdMx3KI',
            parentId: null
        },
        {
            id: 'emp_002',
            name: 'Sarah Jenkins',
            email: 'sarah.jenkins@acme.corp',
            department: 'Engineering',
            location: 'San Francisco, USA',
            status: 'active',
            startDate: '2018-05-20',
            gender: 'Female',
            phone: '14155550202',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuACAxx_ILiip8vy6J0axyDfIy4lduNGggOqzXtLSL-fP5kBpTIeHvDwB7VnAshQu6wEUUvBky6cxDBEyYdB0gNMrVbgfgA4xHJ2kBgH9qGd1q8EcDETIdWcfdOdglXc-1YLT7-db-6GXS1cahQDC2zFGBbbhivxYnsBJc5J_lT2XaWErnzsuAFWJRwtFSW-6wmJ1T4ZYt-w0zYS9a4jbPGoAn72jmo2rhhlzCc7_mkoTm1-k_bZMcJR1pfRH8mAyfmp7oYJbZK2siWS',
            parentId: 'emp_001'
        },
        {
            id: 'emp_003',
            name: 'Marcus Thorne',
            email: 'marcus.thorne@acme.corp',
            department: 'Marketing',
            location: 'London, UK',
            status: 'active',
            startDate: '2020-09-15',
            gender: 'Male',
            phone: '442075550303',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBKl4mEqHa4YVu_HOoNY3f5eASwmqnt-PIB_MTMzUTFmHVNJxsu8nsHgzYK46IvsrrGYAbsQzayUKP7wb_bMOiRIg3pHtbOG-hbXeAlslFlvpAGQ8iwRbXPmAejP2BIxN-tj0I8Spc6bbd_1GLFZ5S6iM2uKg_cSdr3vIHQZNjKeIylmeHS--kUH72vosGonmOjJpzXQUd10Ypt6R0j5HvXHgq5wyBA8DX1nbG6x1ofcomY3Vc3u8vrnm-8t9LYskej7WKhwkx8KLRT',
            parentId: 'emp_001'
        },
        {
            id: 'emp_004',
            name: 'Alicia Vance',
            email: 'alicia.vance@acme.corp',
            department: 'Operations',
            location: 'Singapore',
            status: 'active',
            startDate: '2021-11-22',
            gender: 'Female',
            phone: '6565550404',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDRmQydPJNSkjzx5-NPoeyu1eSKEJFk8P14e-RBNMUZIUXP4qNuMzLZ4_29CF0iaZ06PvpDgcjpZwPhXvNQ0PoPvWXUBBHli2fIEwg5fA_IYcsOcwGWsT1A4EmxwJUcNzcy5P6W6P5LWRZNBnkWD1gXGOc7ckjA2ZJJ21UZY3H7nXNhkJ6if0y9bzf00WIIjOqALPcu6xC1jgNBE3SN3vxBMX6p2P_f6kqNQY5tnABatrGEn6H_RkBY_DDZiqo-warwPqUsYfGqWKKc',
            parentId: 'emp_001'
        },
        {
            id: 'emp_005',
            name: 'Michael Chen',
            email: 'michael.chen@acme.corp',
            department: 'Engineering',
            location: 'San Francisco, USA',
            status: 'active',
            startDate: '2022-03-10',
            gender: 'Male',
            phone: '14155550505',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDaX8t91nk56nc0t9TRPtITd1mOvg9YRBdtjjDyO3NXgZf9UvPMeNRFDKfMfxYdHcQCuL6GdKMilHuM1shJrlgA_fVGuC32NtPDEixSpzuv4TOZXKmLp6kd1BkxZ4K-u4YOQKbXP6pAsUCI1Av8YLYpzkGWfiKGAzqi6tcFYSVUv104gDQMik1HA4UvNySrAvTXVbICnOBnzupREzjp-ic8LMi_AInTdtjQlCC20H6kI4dJCKKA6D3Ha6Wvu55UodfCvSlchZigdAgn',
            parentId: 'emp_002'
        },
        {
            id: 'emp_006',
            name: 'Elena Rodriguez',
            email: 'elena.rodriguez@acme.corp',
            department: 'Engineering',
            location: 'Madrid, Spain',
            status: 'active',
            startDate: '2023-01-05',
            gender: 'Female',
            phone: '34915550606',
            avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAuCbKUqi-vVQmzTaZY4aknHFsKs01AnEBF92Dm2-olR5bqGMPJasZgxhbCFu55pAk_3U83-SEOsNmhw8JOEo_tM0seoP8Yn2iAypiL4O3KAvExecedbP5E2FP26OX9D4SAfL6bmS7l2dyWw1Moccw1-RUs3O8WmA7Qfd1yTufNAiBj2dFTDPihaM0RfAcofYnWhgNiBJoOeKcRkpuK985tJyYRBAbnI0CbQfJRhm2sv7n-_W0YIGLKf9CLbeWNAU-3E339ryMX_9Ud',
            parentId: 'emp_002'
        },
        // --- Directory Employees (Searching these should work) ---
        {
            id: 'emp_dir_001',
            name: 'Christian Alquizola',
            email: 'christian.alquizola@company.com',
            department: 'Pricing',
            location: 'Cebu, Philippines',
            status: 'active',
            startDate: '2024-01-03',
            gender: 'Male',
            phone: '6397516011',
            avatar: 'https://ui-avatars.com/api/?name=Christian+Alquizola&background=6366f1&color=fff&bold=true&size=128',
            parentId: null
        },
        {
            id: 'emp_dir_002',
            name: 'Cindy Bobosa',
            email: 'cindy.bobosa@company.com',
            department: 'Operations',
            location: 'Metro Manila, Philippines',
            status: 'active',
            startDate: '2020-12-21',
            gender: 'Female',
            phone: '6397516011',
            avatar: 'https://ui-avatars.com/api/?name=Cindy+Bobosa&background=ec4899&color=fff&bold=true&size=128',
            parentId: null
        },
        {
            id: 'emp_dir_003',
            name: 'Daniel Trinidad',
            email: 'daniel.trinidad@company.com',
            department: 'Purchasing',
            location: 'Metro Manila, Philippines',
            status: 'active',
            startDate: '2025-09-09',
            gender: 'Male',
            phone: '6396116011',
            avatar: 'https://ui-avatars.com/api/?name=Daniel+Trinidad&background=f59e0b&color=fff&bold=true&size=128',
            parentId: null
        }
    ];

    // ── Change listeners ─────────────────────────────────────────────────
    const listeners = [];

    function notifyListeners(action, data) {
        listeners.forEach(fn => {
            try { fn(action, data); }
            catch (e) { console.error('SharedEmployeeStore listener error:', e); }
        });
    }

    // ── Public API ───────────────────────────────────────────────────────
    return {
        /** Register a callback: fn(action, data) */
        onChange(fn) {
            listeners.push(fn);
        },

        /** Get all employees (returns a copy) */
        getAll() {
            return [...employees];
        },

        /** Get one employee by ID */
        getById(id) {
            return employees.find(e => e.id === id) || null;
        },

        /** Add a new employee */
        add(data, silent = false) {
            const id = 'emp_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
            const employee = {
                id,
                name: data.name || '',
                email: data.email || '',
                department: data.department || '',
                location: data.location || '',
                status: data.status || 'active',
                startDate: data.startDate || new Date().toISOString().split('T')[0],
                gender: data.gender || '',
                phone: data.phone || '',
                avatar: data.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name || 'New')}&background=6366f1&color=fff&bold=true&size=128`,
                parentId: data.parentId || null
            };
            employees.unshift(employee);

            // Log the event
            if (!silent && typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'hire',
                    action: 'New employee joined the team',
                    target: employee.name,
                    details: `Assigned to ${employee.department} in ${employee.location}`,
                    icon: 'person_add',
                    iconBg: 'bg-emerald-500'
                });
            }

            notifyListeners('add', employee);
            return employee;
        },

        /** Update an existing employee (partial data merge) */
        update(id, data) {
            const idx = employees.findIndex(e => e.id === id);
            if (idx === -1) return null;
            const oldData = { ...employees[idx] };
            employees[idx] = { ...employees[idx], ...data };

            // Log the event with more detail
            if (typeof SharedLogStore !== 'undefined') {
                if (data.name && data.name !== oldData.name) {
                    SharedLogStore.add({
                        type: 'update',
                        action: 'Updated profile information for',
                        target: data.name,
                        details: `Name changed from "${oldData.name}" to "${data.name}"`,
                        icon: 'person',
                        iconBg: 'bg-indigo-500'
                    });
                } else if (data.department && data.department !== oldData.department) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Assigned ${employees[idx].name} to`,
                        target: data.department,
                        details: `Transferred from ${oldData.department} to ${data.department}`,
                        icon: 'domain',
                        iconBg: 'bg-purple-500'
                    });
                } else if (data.location && data.location !== oldData.location) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Relocated ${employees[idx].name} to`,
                        target: data.location,
                        details: `Moved from ${oldData.location} to ${data.location}`,
                        icon: 'location_on',
                        iconBg: 'bg-amber-500'
                    });
                } else if (data.status && data.status !== oldData.status) {
                    SharedLogStore.add({
                        type: 'update',
                        action: `Changed status for ${employees[idx].name} to`,
                        target: data.status,
                        details: `Status updated from ${oldData.status} to ${data.status}`,
                        icon: 'event_repeat',
                        iconBg: 'bg-slate-500'
                    });
                } else {
                    const changedFields = Object.keys(data).filter(key => data[key] !== oldData[key]);
                    SharedLogStore.add({
                        type: 'update',
                        action: 'Updated profile details for',
                        target: employees[idx].name,
                        details: changedFields.length > 0 ? `Modified: ${changedFields.join(', ')}` : 'No fields were changed',
                        icon: 'manage_accounts',
                        iconBg: 'bg-slate-400'
                    });
                }
            }

            notifyListeners('update', employees[idx]);
            return employees[idx];
        },

        /** Delete an employee by ID */
        delete(id) {
            const emp = employees.find(e => e.id === id);
            if (!emp) return null;
            employees = employees.filter(e => e.id !== id);

            // Log the event
            if (typeof SharedLogStore !== 'undefined') {
                SharedLogStore.add({
                    type: 'delete',
                    action: 'Removed employee from directory',
                    target: emp.name,
                    details: `Final department: ${emp.department} (${emp.location})`,
                    icon: 'person_off',
                    iconBg: 'bg-red-500'
                });
            }

            notifyListeners('delete', emp);
            return emp;
        },

        /** Replace the entire data set (e.g., from Firebase) */
        setAll(data) {
            employees = data;
            notifyListeners('reset', null);
        }
    };
})();


