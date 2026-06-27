import {
  applyTransition,
  canEdit,
  canDelete,
  StateTransitionError,
  ApplicationStatus,
} from '../services/stateMachine';

import { describe, it, expect } from '@jest/globals'; // For newer versions of Jest


describe('stateMachine.applyTransition', () => {
  describe('legal transitions', () => {
    it('owner submits a DRAFT -> SUBMITTED', () => {
      const result = applyTransition({
        currentStatus: 'DRAFT',
        action: 'SUBMIT',
        actorRole: 'APPLICANT',
        isOwner: true,
      });
      expect(result.nextStatus).toBe('SUBMITTED');
    });

    it('owner re-submits a RETURNED application -> SUBMITTED', () => {
      const result = applyTransition({
        currentStatus: 'RETURNED',
        action: 'SUBMIT',
        actorRole: 'APPLICANT',
        isOwner: true,
      });
      expect(result.nextStatus).toBe('SUBMITTED');
    });

    it('reviewer claims a SUBMITTED application -> UNDER_REVIEW', () => {
      const result = applyTransition({
        currentStatus: 'SUBMITTED',
        action: 'CLAIM',
        actorRole: 'REVIEWER',
        isOwner: false,
      });
      expect(result.nextStatus).toBe('UNDER_REVIEW');
    });

    it('reviewer approves directly from SUBMITTED (no claim required)', () => {
      const result = applyTransition({
        currentStatus: 'SUBMITTED',
        action: 'APPROVE',
        actorRole: 'REVIEWER',
        isOwner: false,
      });
      expect(result.nextStatus).toBe('APPROVED');
    });

    it('reviewer approves from UNDER_REVIEW', () => {
      const result = applyTransition({
        currentStatus: 'UNDER_REVIEW',
        action: 'APPROVE',
        actorRole: 'REVIEWER',
        isOwner: false,
      });
      expect(result.nextStatus).toBe('APPROVED');
    });

    it('reviewer rejects from SUBMITTED with a comment', () => {
      const result = applyTransition({
        currentStatus: 'SUBMITTED',
        action: 'REJECT',
        actorRole: 'REVIEWER',
        isOwner: false,
        comment: 'Missing receipts.',
      });
      expect(result.nextStatus).toBe('REJECTED');
    });

    it('reviewer rejects from UNDER_REVIEW with a comment', () => {
      const result = applyTransition({
        currentStatus: 'UNDER_REVIEW',
        action: 'REJECT',
        actorRole: 'REVIEWER',
        isOwner: false,
        comment: 'Out of policy.',
      });
      expect(result.nextStatus).toBe('REJECTED');
    });

    it('reviewer returns from SUBMITTED with a comment', () => {
      const result = applyTransition({
        currentStatus: 'SUBMITTED',
        action: 'RETURN',
        actorRole: 'REVIEWER',
        isOwner: false,
        comment: 'Please attach the invoice.',
      });
      expect(result.nextStatus).toBe('RETURNED');
    });

    it('reviewer returns from UNDER_REVIEW with a comment', () => {
      const result = applyTransition({
        currentStatus: 'UNDER_REVIEW',
        action: 'RETURN',
        actorRole: 'REVIEWER',
        isOwner: false,
        comment: 'Amount looks wrong, please double check.',
      });
      expect(result.nextStatus).toBe('RETURNED');
    });
  });

  describe('illegal transitions: terminal states', () => {
    const terminal: ApplicationStatus[] = ['APPROVED', 'REJECTED'];

    it.each(terminal)('%s cannot be transitioned again via APPROVE', (status) => {
      expect(() =>
        applyTransition({
          currentStatus: status,
          action: 'APPROVE',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });

    it.each(terminal)('%s cannot be transitioned again via SUBMIT', (status) => {
      expect(() =>
        applyTransition({
          currentStatus: status,
          action: 'SUBMIT',
          actorRole: 'APPLICANT',
          isOwner: true,
        }),
      ).toThrow(StateTransitionError);
    });
  });

  describe('illegal transitions: wrong source status', () => {
    it('cannot SUBMIT an already-SUBMITTED application', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'SUBMIT',
          actorRole: 'APPLICANT',
          isOwner: true,
        }),
      ).toThrow(/Cannot perform SUBMIT from status SUBMITTED/);
    });

    it('cannot CLAIM a DRAFT application', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'DRAFT',
          action: 'CLAIM',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });

    it('cannot CLAIM an already UNDER_REVIEW application', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'UNDER_REVIEW',
          action: 'CLAIM',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });

    it('cannot APPROVE a DRAFT application', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'DRAFT',
          action: 'APPROVE',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });

    it('cannot RETURN a DRAFT application', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'DRAFT',
          action: 'RETURN',
          actorRole: 'REVIEWER',
          isOwner: false,
          comment: 'irrelevant',
        }),
      ).toThrow(StateTransitionError);
    });
  });

  describe('illegal transitions: wrong role', () => {
    it('an applicant cannot APPROVE (even their own application)', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'APPROVE',
          actorRole: 'APPLICANT',
          isOwner: true,
        }),
      ).toThrow(StateTransitionError);
    });

    it('an applicant cannot REJECT', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'REJECT',
          actorRole: 'APPLICANT',
          isOwner: true,
          comment: 'self-reject attempt',
        }),
      ).toThrow(StateTransitionError);
    });

    it('an applicant cannot CLAIM', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'CLAIM',
          actorRole: 'APPLICANT',
          isOwner: true,
        }),
      ).toThrow(StateTransitionError);
    });

    it('a reviewer cannot SUBMIT', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'DRAFT',
          action: 'SUBMIT',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });
  });

  describe('illegal transitions: non-owner applicant', () => {
    it('a non-owner applicant cannot SUBMIT someone else\'s draft', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'DRAFT',
          action: 'SUBMIT',
          actorRole: 'APPLICANT',
          isOwner: false,
        }),
      ).toThrow(/Only the owner/);
    });
  });

  describe('comment requirements', () => {
    it('REJECT without a comment throws COMMENT_REQUIRED', () => {
      try {
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'REJECT',
          actorRole: 'REVIEWER',
          isOwner: false,
        });
        // expect.unreachable('Expected apply Transition to throw')
      } catch (e) {
        expect(e).toBeInstanceOf(StateTransitionError);
        expect((e as StateTransitionError).code).toBe('COMMENT_REQUIRED');
      }
    });

    it('REJECT with a whitespace-only comment throws COMMENT_REQUIRED', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'REJECT',
          actorRole: 'REVIEWER',
          isOwner: false,
          comment: '   ',
        }),
      ).toThrow(StateTransitionError);
    });

    it('RETURN without a comment throws COMMENT_REQUIRED', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'RETURN',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).toThrow(StateTransitionError);
    });

    it('APPROVE does not require a comment', () => {
      expect(() =>
        applyTransition({
          currentStatus: 'SUBMITTED',
          action: 'APPROVE',
          actorRole: 'REVIEWER',
          isOwner: false,
        }),
      ).not.toThrow();
    });
  });
});

describe('stateMachine.canEdit', () => {
  it('owner can edit a DRAFT', () => {
    expect(canEdit('DRAFT', 'APPLICANT', true)).toBe(true);
  });

  it('owner can edit a RETURNED application', () => {
    expect(canEdit('RETURNED', 'APPLICANT', true)).toBe(true);
  });

  it('owner cannot edit a SUBMITTED application', () => {
    expect(canEdit('SUBMITTED', 'APPLICANT', true)).toBe(false);
  });

  it('owner cannot edit an UNDER_REVIEW application', () => {
    expect(canEdit('UNDER_REVIEW', 'APPLICANT', true)).toBe(false);
  });

  it('owner cannot edit an APPROVED application', () => {
    expect(canEdit('APPROVED', 'APPLICANT', true)).toBe(false);
  });

  it('a non-owner applicant cannot edit a DRAFT they do not own', () => {
    expect(canEdit('DRAFT', 'APPLICANT', false)).toBe(false);
  });

  it('a reviewer cannot edit any application', () => {
    expect(canEdit('DRAFT', 'REVIEWER', false)).toBe(false);
  });
});

describe('stateMachine.canDelete', () => {
  it('mirrors canEdit for the owner on a DRAFT', () => {
    expect(canDelete('DRAFT', 'APPLICANT', true)).toBe(true);
  });

  it('cannot delete a SUBMITTED application', () => {
    expect(canDelete('SUBMITTED', 'APPLICANT', true)).toBe(false);
  });
});
