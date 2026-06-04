/**
 * Phase 8f.4h — extract the 3-callback task evidence trio out of
 * useAmroWorkspaceState.
 *
 * Returns {
 *   updateTaskExecutionStatus,
 *   uploadTaskEvidence,
 *   submitTaskSignature,
 * }
 *
 * All three POST to /api/v2/amro/tasks?interface=...  and share the
 * same auth + error-handling pattern. uploadTaskEvidence is the only
 * one that mutates state (appends to evidenceChain on success).
 *
 * Pure refactor — behavior identical.
 */

import { useCallback } from 'react';

import {
  parseJsonSafe,
  isNetworkConnectivityError,
} from './amroWorkspaceHelpers';
import type {
  AmroEvidenceRecord,
  AmroQualification,
} from '../workspace/amroWorkspaceModel';

export interface UseAmroTaskEvidenceMutationsInput {
  apiBaseUrl: string;
  authHeaders: Record<string, string> | null;
  isApiTemporarilyUnavailable: () => boolean;
  markApiTemporarilyUnavailable: () => void;
  setWorkOrdersError: React.Dispatch<React.SetStateAction<string | null>>;

  selectedWorkOrderId: string;
  selectedQualification: AmroQualification | null;

  setEvidenceChain: React.Dispatch<React.SetStateAction<AmroEvidenceRecord[]>>;
  fetchTasksForWorkOrder: (workOrderId: string) => Promise<void>;
}

export interface UseAmroTaskEvidenceMutationsReturn {
  updateTaskExecutionStatus: (
    taskId: string,
    action: 'start' | 'complete' | 'block' | 'reopen',
  ) => Promise<boolean>;
  uploadTaskEvidence: (taskId: string) => Promise<boolean>;
  submitTaskSignature: (taskId: string) => Promise<boolean>;
}

export function useAmroTaskEvidenceMutations(
  input: UseAmroTaskEvidenceMutationsInput,
): UseAmroTaskEvidenceMutationsReturn {
  const {
    apiBaseUrl,
    authHeaders,
    isApiTemporarilyUnavailable,
    markApiTemporarilyUnavailable,
    setWorkOrdersError,
    selectedWorkOrderId,
    selectedQualification,
    setEvidenceChain,
    fetchTasksForWorkOrder,
  } = input;

  const updateTaskExecutionStatus = useCallback(
    async (taskId: string, action: 'start' | 'complete' | 'block' | 'reopen') => {
      if (!authHeaders || !selectedWorkOrderId) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/tasks?interface=update-task-step`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              task_id: taskId,
              step_id: `step-${taskId}`,
              action,
              performed_at: new Date().toISOString(),
              device_id: 'amro-ui-workspace',
            }),
          },
        );
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to update task step (${response.status})`);
        }
        await fetchTasksForWorkOrder(selectedWorkOrderId);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to update task step');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      fetchTasksForWorkOrder,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedWorkOrderId,
      setWorkOrdersError,
    ],
  );

  const uploadTaskEvidence = useCallback(
    async (taskId: string) => {
      if (!authHeaders) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const now = Date.now();
        const response = await fetch(`${apiBaseUrl}/api/v2/amro/tasks?interface=upload-evidence`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            task_id: taskId,
            evidence_type: 'photo',
            media_ref: `amro://evidence/${taskId}/${now}`,
            checksum: `sha256-${now}`,
          }),
        });
        const payload = await parseJsonSafe<{
          output?: { evidence_id?: string };
          error?: string;
        }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to upload evidence (${response.status})`);
        }
        const evidenceId = String(payload?.output?.evidence_id || `${taskId}-${now}`);
        setEvidenceChain((previous) => [
          ...previous,
          {
            id: evidenceId,
            entityType: 'task',
            entityId: taskId,
            hash: `sha256-${now}`,
            immutable: true,
            createdAt: new Date(now).toISOString(),
          },
        ]);
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(
          error instanceof Error ? error.message : 'Failed to upload task evidence',
        );
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      setEvidenceChain,
      setWorkOrdersError,
    ],
  );

  const submitTaskSignature = useCallback(
    async (taskId: string) => {
      if (!authHeaders || !selectedQualification) return false;
      if (isApiTemporarilyUnavailable()) {
        setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
        return false;
      }
      try {
        const response = await fetch(
          `${apiBaseUrl}/api/v2/amro/tasks?interface=submit-signature`,
          {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify({
              task_id: taskId,
              signer_id: selectedQualification.id,
              signature_payload: `sig-${selectedQualification.id}-${Date.now()}`,
              method: 'digital_certificate',
            }),
          },
        );
        const payload = await parseJsonSafe<{ error?: string }>(response);
        if (!response.ok) {
          throw new Error(payload?.error || `Failed to submit signature (${response.status})`);
        }
        return true;
      } catch (error) {
        if (isNetworkConnectivityError(error)) {
          markApiTemporarilyUnavailable();
          setWorkOrdersError('AMRO API is temporarily unavailable. Retrying shortly.');
          return false;
        }
        setWorkOrdersError(error instanceof Error ? error.message : 'Failed to submit signature');
        return false;
      }
    },
    [
      apiBaseUrl,
      authHeaders,
      isApiTemporarilyUnavailable,
      markApiTemporarilyUnavailable,
      selectedQualification,
      setWorkOrdersError,
    ],
  );

  return {
    updateTaskExecutionStatus,
    uploadTaskEvidence,
    submitTaskSignature,
  };
}
