import { Button } from './ui.jsx';
import { Badge } from './ui.jsx';

export function ApprovalCard({ approval, busy, onApprove, onReject }) {
  if (!approval || approval.state === 'approved') return null;
  return (
    <div className="feed-row rounded-lg border border-warning/40 bg-[#fffaf3] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Approval required</h3>
        <Badge tone={approval.risk === 'high' ? 'critical' : approval.risk === 'low' ? 'success' : 'warning'}>{approval.risk} risk</Badge>
      </div>
      <p className="mt-2 text-sm font-medium">{approval.title}</p>
      <p className="mt-1 font-mono text-sm">Change: {approval.change}</p>
      <p className="mt-2 text-sm text-muted">{approval.rationale}</p>
      <p className="mt-1 text-sm">Expected impact: {approval.expectedImpact}</p>
      {approval.state === 'rejected' ? <p className="mt-2 text-sm text-critical">Rejected. The agent will propose an alternative or escalate.</p> : (
        <div className="mt-4 flex gap-2">
          <Button variant="danger" disabled={busy} onClick={onReject}>Reject</Button>
          <Button disabled={busy} onClick={onApprove}>Authorize Action</Button>
        </div>
      )}
    </div>
  );
}
