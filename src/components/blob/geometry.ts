// Blob's body in its 200 × 200 viewBox, shared by the body, the face and the outfits.

/** Points on the jelly outline. */
export const N = 12;
export const CX = 100;
export const R = 62;
export const GROUND = 172;
export const BOTTOM = R * 0.8;
export const BODY_Y = GROUND - BOTTOM;
export const FACE_Y = BODY_Y - 4;
export const MOUTH_Y = FACE_Y + 20;
export const ARM_X = CX + 57;
export const ARM_Y = FACE_Y + 21;
/** Eyes sit this far left and right of the middle. */
export const EYE_X = 22;
export const INK = "var(--blob-face)";
