/*
<An application to manage the inventory count and analysis of the most popular vehicles on sale.>
Copyright (C) 2024  Darel Johnson

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/


let currentPage = 'admin';
let vehicleCountChart = null;
let vehiclesByMakeChart = null;
let allVehicles = [];
let filteredVehicles = [];
let currentAdminPage = 1;
let currentAnalysisPage = 1;
const itemsPerPage = 10;

function filterVehicles(searchTerm) {
    return allVehicles.filter(vehicle => 
        vehicle.make.toLowerCase().includes(searchTerm) ||
        vehicle.model.toLowerCase().includes(searchTerm) ||
        vehicle.year.toString().includes(searchTerm)
    );
}

function displayVehicles(vehicles) {
    const tbody = document.querySelector('#vehicle-table tbody');
    tbody.innerHTML = '';
    const startIndex = (currentAdminPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedVehicles = vehicles.slice(startIndex, endIndex);

    paginatedVehicles.forEach(vehicle => {
        const row = tbody.insertRow();
        row.insertCell().textContent = vehicle.make;
        row.insertCell().textContent = vehicle.model;
        
        const yearCell = row.insertCell();
        yearCell.textContent = vehicle.year;
        yearCell.className = 'text-center px-2 w-20';
        
        const actionsCell = row.insertCell();
        actionsCell.className = 'text-center px-2 w-32';
        
        const editBtn = document.createElement('button');
        editBtn.textContent = 'Edit';
        editBtn.className = 'bg-yellow-500 text-white px-2 py-1 rounded hover:bg-yellow-600 mr-1 text-xs';
        editBtn.onclick = () => editVehicle(vehicle);
        actionsCell.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs';
        deleteBtn.onclick = () => deleteVehicle(vehicle.id);
        actionsCell.appendChild(deleteBtn);
    });

    updatePagination(vehicles.length, 'admin');
}

function editVehicle(vehicle) {
    document.getElementById('vehicle-id').value = vehicle.id;
    document.getElementById('make').value = vehicle.make;
    document.getElementById('model').value = vehicle.model;
    document.getElementById('year').value = vehicle.year;
    document.getElementById('submit-btn').textContent = 'Update Vehicle';
    document.getElementById('cancel-btn').classList.remove('hidden');
}

async function deleteVehicle(id) {
    if (confirm('Are you sure you want to delete this vehicle?')) {
        await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
        loadVehicles();
    }
}

async function loadVehicles() {
    const response = await fetch('/api/vehicles');
    allVehicles = await response.json();
    filteredVehicles = []; // Reset filtered vehicles
    displayVehicles(allVehicles);
}

async function loadAnalysis() {
    const response = await fetch('/api/analysis');
    const data = await response.json();
    allVehicles = data.vehicles;
    filteredVehicles = []; // Reset filtered vehicles
    displayAnalysis(allVehicles);
    document.getElementById('total-count').textContent = data.totalCount;
    updateCharts(data);
}

function displayAnalysis(vehicles) {
    const tbody = document.querySelector('#analysis-table tbody');
    tbody.innerHTML = '';
    const startIndex = (currentAnalysisPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedVehicles = vehicles.slice(startIndex, endIndex);

    paginatedVehicles.forEach(vehicle => {
        const row = tbody.insertRow();
        row.insertCell().textContent = vehicle.make;
        row.insertCell().textContent = vehicle.model;
        
        const yearCell = row.insertCell();
        yearCell.textContent = vehicle.year;
        yearCell.className = 'text-center px-2 w-20';
        
        const counterCell = row.insertCell();
        counterCell.textContent = vehicle.count;
        counterCell.className = 'text-center px-2 w-20';
        
        const actionCell = row.insertCell();
        actionCell.className = 'text-center px-2 w-24';
        const countButton = document.createElement('button');
        countButton.textContent = 'Count';
        countButton.className = 'bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 text-xs';
        countButton.onclick = () => incrementCount(vehicle.id);
        actionCell.appendChild(countButton);
    });

    updatePagination(vehicles.length, 'analysis');
}

async function incrementCount(vehicleId) {
    await fetch(`/api/count/${vehicleId}`, { method: 'POST' });
    loadAnalysis();
}

function updateCharts(data) {
    updateVehicleCountChart(data.vehicles);
    updateVehiclesByMakeChart(data.vehicles);
}

function updateVehicleCountChart(vehicles) {
    // Sort vehicles by count in descending order and take the top 20
    const topVehicles = vehicles
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

    const ctx = document.getElementById('vehicleCountChart').getContext('2d');
    const data = {
        labels: topVehicles.map(v => `${v.make} ${v.model}`),
        datasets: [{
            label: 'Vehicle Count',
            data: topVehicles.map(v => v.count),
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1
        }]
    };
    
    if (vehicleCountChart) {
        vehicleCountChart.data = data;
        vehicleCountChart.update();
    } else {
        vehicleCountChart = new Chart(ctx, {
            type: 'bar',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'Top 20 Vehicles by Count',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

function updateVehiclesByMakeChart(vehicles) {
    const ctx = document.getElementById('vehiclesByMakeChart').getContext('2d');
    const makeCount = vehicles.reduce((acc, v) => {
        acc[v.make] = (acc[v.make] || 0) + 1;
        return acc;
    }, {});
    
    // Define a larger color palette
    const colorPalette = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF9F40',
        '#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF',
        '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF9F40'
    ];

    // Generate dynamic colors if there are more makes than colors in the palette
    const dynamicColors = () => {
        return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    };

    const data = {
        labels: Object.keys(makeCount),
        datasets: [{
            data: Object.values(makeCount),
            backgroundColor: Object.keys(makeCount).map((_, index) => 
                index < colorPalette.length ? colorPalette[index] : dynamicColors()
            ),
        }]
    };
    
    if (vehiclesByMakeChart) {
        vehiclesByMakeChart.data = data;
        vehiclesByMakeChart.update();
    } else {
        vehiclesByMakeChart = new Chart(ctx, {
            type: 'pie',
            data: data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10
                    }
                },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
    }
}

function updatePagination(totalItems, pageType) {
    const pageCount = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById(`${pageType}-pagination`);
    paginationContainer.innerHTML = '';

    const currentPage = pageType === 'admin' ? currentAdminPage : currentAnalysisPage;

    // Calculate the range of pages to display
    let startPage = Math.max(currentPage - 2, 1);
    let endPage = Math.min(startPage + 4, pageCount);

    // Adjust the range if we're near the end
    if (endPage - startPage < 4) {
        startPage = Math.max(endPage - 4, 1);
    }

    // Previous button
    const prevButton = document.createElement('button');
    prevButton.textContent = '←';
    prevButton.className = `mx-1 px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
    prevButton.onclick = () => {
        if (currentPage > 1) {
            changePage(pageType, currentPage - 1);
        }
    };
    paginationContainer.appendChild(prevButton);

    // Page numbers
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.textContent = i;
        pageButton.className = `mx-1 px-3 py-1 rounded ${
            currentPage === i
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
        }`;
        pageButton.onclick = () => changePage(pageType, i);
        paginationContainer.appendChild(pageButton);
    }

    // Next button
    const nextButton = document.createElement('button');
    nextButton.textContent = '→';
    nextButton.className = `mx-1 px-3 py-1 rounded ${currentPage === pageCount ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`;
    nextButton.onclick = () => {
        if (currentPage < pageCount) {
            changePage(pageType, currentPage + 1);
        }
    };
    paginationContainer.appendChild(nextButton);
}

function changePage(pageType, newPage) {
    if (pageType === 'admin') {
        currentAdminPage = newPage;
        displayVehicles(filteredVehicles.length > 0 ? filteredVehicles : allVehicles);
    } else {
        currentAnalysisPage = newPage;
        displayAnalysis(filteredVehicles.length > 0 ? filteredVehicles : allVehicles);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const vehicleForm = document.getElementById('vehicle-form');
    const adminSearch = document.getElementById('admin-search');
    const analysisSearch = document.getElementById('analysis-search');
    const adminClearSearch = document.getElementById('admin-clear-search');
    const analysisClearSearch = document.getElementById('analysis-clear-search');
    const cancelBtn = document.getElementById('cancel-btn');

    vehicleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('vehicle-id').value;
        const make = document.getElementById('make').value;
        const model = document.getElementById('model').value;
        const year = document.getElementById('year').value;
        
        try {
            if (id) {
                await fetch(`/api/vehicles/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ make, model, year })
                });
            } else {
                await fetch('/api/vehicles', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ make, model, year })
                });
            }
            loadVehicles();
            resetForm();
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to save vehicle. Please try again.');
        }
    });

    cancelBtn.addEventListener('click', resetForm);

    adminSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filteredVehicles = filterVehicles(searchTerm);
        currentAdminPage = 1;
        displayVehicles(filteredVehicles);
    });

    analysisSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        filteredVehicles = filterVehicles(searchTerm);
        currentAnalysisPage = 1;
        displayAnalysis(filteredVehicles);
        updateCharts({ vehicles: filteredVehicles, totalCount: calculateTotalCount(filteredVehicles) });
        
        const vehiclesByMakeChartContainer = document.getElementById('vehiclesByMakeChart').parentElement;
        if (searchTerm) {
            vehiclesByMakeChartContainer.classList.add('hidden');
        } else {
            vehiclesByMakeChartContainer.classList.remove('hidden');
            updateVehiclesByMakeChart(allVehicles);
        }
    });

    adminClearSearch.addEventListener('click', () => {
        adminSearch.value = '';
        filteredVehicles = [];
        currentAdminPage = 1;
        displayVehicles(allVehicles);
    });

    analysisClearSearch.addEventListener('click', () => {
        analysisSearch.value = '';
        filteredVehicles = [];
        currentAnalysisPage = 1;
        displayAnalysis(allVehicles);
        updateCharts({ vehicles: allVehicles, totalCount: calculateTotalCount(allVehicles) });
        document.getElementById('vehiclesByMakeChart').parentElement.classList.remove('hidden');
        updateVehiclesByMakeChart(allVehicles);
    });

    showPage('admin');
});

function resetForm() {
    document.getElementById('vehicle-form').reset();
    document.getElementById('vehicle-id').value = '';
    document.getElementById('submit-btn').textContent = 'Add Vehicle';
    document.getElementById('cancel-btn').classList.add('hidden');
}

function calculateTotalCount(vehicles) {
    return vehicles.reduce((total, vehicle) => total + vehicle.count, 0);
}

function showPage(page) {
    document.getElementById('admin-page').classList.add('hidden');
    document.getElementById('analysis-page').classList.add('hidden');
    document.getElementById(`${page}-page`).classList.remove('hidden');
    
    document.querySelectorAll('nav a').forEach(link => {
        link.classList.remove('text-blue-800', 'font-bold');
        link.classList.add('text-blue-600');
    });
    document.querySelector(`nav a[onclick="showPage('${page}')"]`).classList.remove('text-blue-600');
    document.querySelector(`nav a[onclick="showPage('${page}')"]`).classList.add('text-blue-800', 'font-bold');
    
    currentPage = page;
    if (page === 'admin') {
        loadVehicles();
    } else if (page === 'analysis') {
        loadAnalysis();
    }
    
    // Reset filteredVehicles and search input when switching pages
    filteredVehicles = [];
    document.getElementById('admin-search').value = '';
    document.getElementById('analysis-search').value = '';
}

// Initialize the page
showPage('admin');

// Add this line to ensure charts are updated when switching to the analysis page
document.querySelector('a[onclick="showPage(\'analysis\')"]').addEventListener('click', loadAnalysis);

// Add this function to handle window resizing
function handleResize() {
    if (vehicleCountChart) {
        vehicleCountChart.resize();
    }
    if (vehiclesByMakeChart) {
        vehiclesByMakeChart.resize();
    }
}

// Add event listener for window resize
window.addEventListener('resize', handleResize);
