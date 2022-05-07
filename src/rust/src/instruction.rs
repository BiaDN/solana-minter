use borsh::{BorshDeserialize, BorshSerialize};
use solana_program::{msg, program_error::ProgramError};
use std::convert::TryInto;

#[derive(Debug, BorshSerialize, BorshDeserialize)]

pub struct TimeStruct {
    pub timeRelease: u64,
}

#[derive(Debug, BorshSerialize, BorshDeserialize)]

pub struct AmoebitIndex {
    pub amount: u64,
}
#[derive(Debug)]

pub enum CountInstruction {
    Index(AmoebitIndex),
    Time(TimeStruct),
    Create(AmoebitIndex),
    Claim(AmoebitIndex)
}

impl CountInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (&tag, rest) = input
            .split_first()
            .ok_or(ProgramError::InvalidInstructionData)?;

        Ok(match tag {
            0 => {
                let (amount, rest) = Self::unpack_u64(rest)?;
                Self::Index(AmoebitIndex { amount })
            }
            1 => {
                let (timeRelease, rest) = Self::unpack_u64(rest)?;
                // HelloInstruction::SayBye
                Self::Time(TimeStruct { timeRelease })
            }
            2 => {
                let (amount_total, rest) = Self::unpack_u64(rest)?;
                Self::Create(AmoebitIndex {
                    amount: amount_total*1000000000,
                })
            }
            3 => {
                let (amount, rest) = Self::unpack_u64(rest)?;
                Self::Claim(AmoebitIndex { amount })
            }
            _ => return Err(ProgramError::InvalidArgument),
        })
    }
    fn unpack_u64(input: &[u8]) -> Result<(u64, &[u8]), ProgramError> {
        if input.len() >= 8 {
            let (amount, rest) = input.split_at(8);
            let amount = amount
                .get(..8)
                .and_then(|slice| slice.try_into().ok())
                .map(u64::from_le_bytes)
                .ok_or(ProgramError::InvalidInstructionData)?;
            msg!("{} {:?}", amount, rest);
            Ok((amount, rest))
        } else {
            Err(ProgramError::InvalidInstructionData.into())
        }
    }
    fn unpack_u128(input: &[u8]) -> Result<(u128, &[u8]), ProgramError> {
        if input.len() >= 8 {
            let (amount, rest) = input.split_at(8);
            msg!("{:?} {:?} start", amount, rest);

            let amount = amount
                .get(..16)
                .and_then(|slice| slice.try_into().ok())
                .map(u128::from_le_bytes)
                .ok_or(ProgramError::InvalidInstructionData)?;
            Ok((amount, rest))
        } else {
            Err(ProgramError::InvalidInstructionData.into())
        }
    }
}
