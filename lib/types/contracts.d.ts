export type SourceApp = 'workbuddy' | 'codex' | 'raccoon' | 'cursor' | 'dsh';
export type Eligibility = 'active' | 'archived' | 'deleted' | 'unknown';
export interface SourceSession {
    sourceId: string;
    app: SourceApp;
    nativeId: string;
    title: string;
    cwd?: string;
    updatedAt?: number;
}
export interface Page<T> {
    items: T[];
    nextCursor?: string;
}
export interface TargetSelection {
    cwd: string;
    agentPreset: string;
}
export interface CaptureResult {
    archivePath: string;
    snapshotDigest: string;
}
export interface PortableBlock {
    type: string;
    text?: string;
    resource_id?: string;
    [key: string]: unknown;
}
export interface PortableEvent {
    id: string;
    seq: number;
    kind: string;
    record_ref: string;
    content: PortableBlock[];
    role?: string;
    native_type?: string;
    native_id?: string;
    timestamp?: string | number;
    active?: boolean;
    visible?: boolean;
    projection?: 'auxiliary' | 'context' | 'display';
    [key: string]: unknown;
}
export interface ObjectRef {
    sha256: string;
    size: number;
    path: string;
}
export interface PortableResource extends Partial<ObjectRef> {
    id: string;
    uri: string;
    record_ref: string;
    status: 'embedded' | 'external' | 'remote' | 'missing';
    media_type?: string;
}
export interface ArchiveManifest {
    id: string;
    format: 'alink.session';
    version: '0.1.0';
    captured_at: string;
    source: {
        app: SourceApp;
        native_format: string;
        location?: string;
        app_version?: string;
    };
    session: {
        native_id?: string;
        title?: string;
        cwd?: string;
        [key: string]: unknown;
    };
    streams: {
        events: 'events.jsonl';
        records: 'records.jsonl';
    };
    resources: PortableResource[];
    original_files: Array<ObjectRef & {
        name: string;
    }>;
    issues: Array<{
        code: string;
        detail: string;
    }>;
    coverage: {
        native_records: number;
        events: number;
        event_kinds: Record<string, number>;
    };
    integrity: Record<string, {
        sha256: string;
        size: number;
    }>;
}
export type IssueDisposition = 'native' | 'rendered' | 'archive-only' | 'missing' | 'blocked';
export interface MigrationIssue {
    code: string;
    disposition: IssueDisposition;
    recordRef?: string;
    resourceId?: string;
    detail: string;
}
export interface MappingReport {
    mappingVersion: '1';
    issues: MigrationIssue[];
    counts: Record<IssueDisposition, number>;
    reportHash: string;
}
export interface Preview {
    previewId: string;
    snapshotDigest: string;
    target: TargetSelection;
    report: MappingReport;
}
export type OperationState = 'prepared' | 'writing' | 'verifying' | 'completed' | 'failed' | 'canceled' | 'needs-attention';
export interface Operation {
    operationId: string;
    previewId: string;
    state: OperationState;
    targetSessionId: string;
    stage: string;
    errorCode?: string;
    title: string;
}
export interface CommitRequest {
    previewId: string;
    reportHash: string;
    requestId: string;
}
