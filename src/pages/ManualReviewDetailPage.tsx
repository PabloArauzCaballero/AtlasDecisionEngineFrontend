import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { errorMessage } from '../api/ApiError';
import { apiRequest } from '../api/http-client';
import { Alert } from '../components/Alert';
import { DefinitionGrid } from '../components/DefinitionGrid';
import { JsonPanel } from '../components/JsonPanel';
import { PageHeader } from '../components/PageHeader';
import { Panel } from '../components/Panel';
import { Timeline } from '../components/Timeline';
import { useDetailQuery } from '../hooks/useDetailQuery';
import { asRecord, display } from '../utils/records';

interface ManualReviewDetailPageProps {
  caseId: string;
}

export function ManualReviewDetailPage({ caseId }: ManualReviewDetailPageProps) {
  const [resolution, setResolution] = useState('APPROVE');
  const [comments, setComments] = useState('');
  const query = useDetailQuery<unknown>(
    'manual-review',
    caseId ? `/v1/manual-reviews/${encodeURIComponent(caseId)}` : null,
  );
  const review = asRecord(query.data);
  const resolve = useMutation({
    mutationFn: () =>
      apiRequest(`/v1/manual-reviews/${encodeURIComponent(caseId)}/resolve`, {
        method: 'POST',
        body: { resolution, comments },
      }),
    onSuccess: () => query.refetch(),
  });

  return (
    <>
      <PageHeader
        eyebrow="F5-04 · Manual Review"
        title={`Case #REV-${display(review, 'id')}`}
        description={`${display(review, 'queueCode')} · ${display(review, 'reason')}`}
        actions={
          <button className="button" type="button">
            <UserCheck size={16} /> Assign to me
          </button>
        }
      />
      {query.isError || resolve.isError ? (
        <Alert tone="error">{errorMessage(query.error ?? resolve.error)}</Alert>
      ) : null}
      <div className="review-detail-grid">
        <main>
          <Panel title="Case Metadata" meta={display(review, 'status')}>
            <DefinitionGrid
              record={review}
              items={[
                { label: 'Priority', keys: ['priority'] },
                { label: 'Queue', keys: ['queueCode'] },
                { label: 'Artifact', keys: ['artifactCode'] },
                { label: 'Customer Ref', keys: ['subjectReference'], mono: true },
                { label: 'Assigned To', keys: ['assignedTo'] },
                { label: 'SLA Due', keys: ['slaDueAt'] },
              ]}
            />
          </Panel>
          <Panel title="Transaction Audit Timeline" meta="Immutable">
            <Timeline
              items={[
                {
                  title: 'Decision executed',
                  detail: display(review, 'reason'),
                  meta: display(review, 'createdAt'),
                },
                {
                  title: 'Case routed to manual review',
                  detail: display(review, 'queueCode'),
                  meta: display(review, 'updatedAt'),
                },
              ]}
            />
          </Panel>
          <JsonPanel label="Input Snapshot" value={review.inputSnapshot ?? review} />
        </main>
        <aside>
          <Panel title="Resolution Form" meta="Required">
            <label className="field">
              <span>Decision</span>
              <select value={resolution} onChange={(event) => setResolution(event.target.value)}>
                <option value="APPROVE">Approve</option>
                <option value="REJECT">Reject</option>
                <option value="ESCALATE">Escalate</option>
              </select>
            </label>
            <label className="field">
              <span>Mandatory comments</span>
              <textarea
                rows={8}
                value={comments}
                onChange={(event) => setComments(event.target.value)}
              />
            </label>
            <button
              className="button button-primary full-width"
              disabled={!comments || !caseId || resolve.isPending}
              onClick={() => resolve.mutate()}
              type="button"
            >
              <CheckCircle2 size={16} /> Submit Decision
            </button>
          </Panel>
        </aside>
      </div>
    </>
  );
}
