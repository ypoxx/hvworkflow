/** Codec boundary for the marked PII part of an event payload (ADR 0009). */
export interface PiiEnvelope {
  keyId: string;
  [field: string]: unknown;
}

export interface PiiCodec {
  encode(meetingId: string | undefined, value: PiiEnvelope): PiiEnvelope;
  decode(meetingId: string | undefined, value: PiiEnvelope): PiiEnvelope;
}

/** Beta placeholder: preserving the envelope makes later key rotation a codec change. */
export const identityPiiCodec: PiiCodec = {
  encode: (_meetingId, value) => value,
  decode: (_meetingId, value) => value,
};
