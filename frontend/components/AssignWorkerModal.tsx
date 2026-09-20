import React, { useState, useEffect, useCallback } from 'react';
import { X, User, Building, IdCard, Phone, Search, Briefcase } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { User as UserType, Department } from '@/types';
import { WorkerService } from '@backend/services/workers/workerService';

interface AssignWorkerModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueId: string;
  issueTitle: string;
  municipalityId?: string;
  currentDepartmentId?: string | null;
  currentWorkerId?: string | null;
  onAssignSuccess: () => void;
}

const AssignWorkerModal: React.FC<AssignWorkerModalProps> = ({
  isOpen,
  onClose,
  issueId,
  issueTitle,
  municipalityId,
  currentDepartmentId,
  currentWorkerId,
  onAssignSuccess
}) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [workers, setWorkers] = useState<UserType[]>([]);
  const [filteredWorkers, setFilteredWorkers] = useState<UserType[]>([]);
  const [workerWorkloads, setWorkerWorkloads] = useState<Record<string, number>>({});
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchDepartments = useCallback(async () => {
    try {
      let query = supabase
        .from('departments')
        .select('id, name, municipality_id')
        .order('name');

      if (municipalityId) {
        query = query.eq('municipality_id', municipalityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDepartments(data || []);
      
      // Auto-select current issue's department, or the only department if length === 1
      if (currentDepartmentId) {
        setSelectedDepartmentId(currentDepartmentId);
      } else if (data && data.length === 1) {
        setSelectedDepartmentId(data[0].id);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  }, [municipalityId, currentDepartmentId]);

  const fetchWorkersByDepartment = useCallback(async (deptId: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('user_profiles')
        .select('id, full_name, role, phone, employee_id, department_id, municipality_id')
        .eq('role', 'worker')
        .eq('department_id', deptId)
        .order('full_name');

      if (municipalityId) {
        query = query.eq('municipality_id', municipalityId);
      }

      const { data, error } = await query;

      if (error) throw error;
      const workerList = data || [];
      setWorkers(workerList);

      // Compute active workloads for workers
      const workerIds = workerList.map((w) => w.id);
      const workloads: Record<string, number> = {};
      for (const id of workerIds) {
        workloads[id] = 0;
      }

      if (workerIds.length > 0) {
        const { data: activeTasks } = await supabase
          .from('issues')
          .select('assigned_worker_id')
          .in('assigned_worker_id', workerIds)
          .in('status', ['submitted', 'verified', 'in_progress']);

        for (const t of activeTasks || []) {
          if (t.assigned_worker_id) {
            workloads[t.assigned_worker_id] = (workloads[t.assigned_worker_id] || 0) + 1;
          }
        }
      }
      setWorkerWorkloads(workloads);
    } catch (error) {
      console.error('Error fetching workers:', error);
      setWorkers([]);
      setWorkerWorkloads({});
    } finally {
      setLoading(false);
    }
  }, [municipalityId]);

  const filterWorkers = useCallback(() => {
    if (!searchQuery.trim()) {
      setFilteredWorkers(workers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = workers.filter(worker =>
      worker.full_name?.toLowerCase().includes(query) ||
      worker.employee_id?.toLowerCase().includes(query) ||
      worker.phone?.includes(query)
    );
    setFilteredWorkers(filtered);
  }, [workers, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      fetchDepartments();
      if (currentWorkerId) {
        setSelectedWorkerId(currentWorkerId);
      }
    }
  }, [isOpen, fetchDepartments, currentWorkerId]);

  useEffect(() => {
    if (selectedDepartmentId) {
      fetchWorkersByDepartment(selectedDepartmentId);
    } else {
      setWorkers([]);
      setFilteredWorkers([]);
    }
  }, [selectedDepartmentId, fetchWorkersByDepartment]);

  useEffect(() => {
    filterWorkers();
  }, [filterWorkers]);

  const handleAssign = async () => {
    if (!selectedWorkerId || !selectedDepartmentId) return;

    setAssigning(true);
    try {
      // Update issue using canonical WorkerService.assignWorker
      await WorkerService.assignWorker({
        issueId,
        workerId: selectedWorkerId,
        departmentId: selectedDepartmentId,
        notes: 'Assigned via municipal authority dashboard override modal',
      });

      onAssignSuccess();
      onClose();
    } catch (error) {
      console.error('Error assigning worker:', error);
      const err = error as Error;
      alert(`Failed to assign worker: ${err.message || 'Please try again.'}`);
    } finally {
      setAssigning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Assign / Reassign Municipal Worker
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {issueTitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Step 1: Select Department */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Step 1: Select Municipal Department <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={selectedDepartmentId}
                onChange={(e) => {
                  setSelectedDepartmentId(e.target.value);
                  setSelectedWorkerId('');
                  setSearchQuery('');
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              >
                <option value="">Choose a department...</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Step 2: Select Worker */}
          {selectedDepartmentId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Step 2: Select Field Worker <span className="text-red-500">*</span>
              </label>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by worker name or employee ID..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>

              {/* Workers List */}
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">Loading department workers...</p>
                </div>
              ) : filteredWorkers.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <User className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {searchQuery ? 'No workers found matching your search' : 'No workers registered in this department'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredWorkers.map((worker) => (
                    <button
                      key={worker.id}
                      onClick={() => setSelectedWorkerId(worker.id)}
                      className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                        selectedWorkerId === worker.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {worker.full_name}
                            </h3>
                            {selectedWorkerId === worker.id && (
                              <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">
                                Selected
                              </span>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                            {worker.employee_id && (
                              <div className="flex items-center gap-2">
                                <IdCard className="w-4 h-4" />
                                <span>ID: {worker.employee_id}</span>
                              </div>
                            )}
                            {worker.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="w-4 h-4" />
                                <span>{worker.phone}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium pt-1">
                              <Briefcase className="w-3.5 h-3.5" />
                              <span>Active Workload: {workerWorkloads[worker.id] || 0} tasks</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedWorkerId || !selectedDepartmentId || assigning}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {assigning ? 'Assigning...' : 'Assign Worker'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignWorkerModal;
