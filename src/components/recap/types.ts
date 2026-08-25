// Shapes shared by the two post-event recap surfaces: the /m memory page and
// the /me recap popup. Both read them straight off getAttendeeMemoryInfo, so
// they live here rather than in either page — a field added on the server
// should only need typing once.

export type Photo = {
  objectId: string;
  url: string | null;
  caption: string | null;
  uploadedAt: string;
  uploaderName: string;
  uploaderId: string | null;
  eventGroupId: string | null;
};

export type SurveyResult = {
  objectId: string;
  rating: number | null;
  comment: string | null;
  hostRating: number | null;
  hostComment: string | null;
  submittedAt: string;
  updatedAt: string;
};

export type SurveyState = {
  acceptingResponses: boolean;
  existing: SurveyResult | null;
  ratingMin: number;
  ratingMax: number;
  commentMaxLen: number;
};

/** Present only on virtual-hosted plans — gates the private host-feedback half. */
export type VirtualHostInfo = {
  personaName: string;
  personaAvatarUrl: string | null;
};

export type PhotoLimits = {
  maxBytes: number;
  maxPerAttendee: number;
  maxPerEvent: number;
};
