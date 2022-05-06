use crate::instruction::{AmoebitIndex, CountInstruction, TimeStruct};
use {
    crate::error::MintError,
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        msg,
        program::{invoke, invoke_signed},
        program_error::ProgramError,
        pubkey::Pubkey,
        rent::Rent,
        system_instruction,
        system_instruction::create_account,
        sysvar::{clock::Clock, Sysvar},
    },
};

use std::str;

// const PREFIX: &str = "amoebit_minter";
// const PREFIX_TIME: &str = "time_realease";

const OUR_WALLET: &str = "69sRgm3962udozhENnTtTQUJMEHBtDQbKLUte1g9H4Hx";

pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

#[warn(unused_must_use)]

pub fn process_instruction<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = CountInstruction::unpack(instruction_data)?;

    let accounts_iter = &mut accounts.iter();

    let index_account = next_account_info(accounts_iter)?; // 0
    let total_token_account = next_account_info(accounts_iter)?; // 2
    let auth_wallet = next_account_info(accounts_iter)?; // 2
    let payer_wallet = next_account_info(accounts_iter)?; // 3
    let time_account = next_account_info(accounts_iter)?; // 4

    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;

    let mut total_token = AmoebitIndex::try_from_slice(&total_token_account.data.borrow())?;
    let mut time_set = TimeStruct::try_from_slice(&time_account.data.borrow())?;

    // let timeRelease = time_set.de
    // pub fn transfer_sol(&from,&to,lamports_to_send) -> ProgramResult{
    //     system_instruction::transfer(from, to, lamports_to_send);
    //     Ok(());
    // }

    match instruction {
        CountInstruction::Index(AmoebitIndex { amount }) => {
            if payer_wallet.key.to_string() == OUR_WALLET && total_token.amount == 0 {
                total_token.amount = 10000000000000000;
                total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;

                return Ok(());
            }

            if total_token.amount < amount {
                return Err(MintError::TokenFailed.into());
            }

            // if auth_wallet.key

            msg!("{}", series_index.amount);

            msg!("{}", time_set.timeRelease);

            series_index.amount += amount;
            total_token.amount -= amount;

            // invoke(
            //     &system_instruction::transfer(
            //         payer_wallet.key,
            //         auth_wallet.key,
            //         1 * LAMPORTS_PER_SOL / 1000,
            //     ),
            //     &[payer_wallet.clone(), auth_wallet.clone()],
            // )?;

            series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;
            total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;
            return Ok(());
        }
        CountInstruction::Time(TimeStruct { timeRelease }) => {
            time_set.timeRelease = timeRelease;
            time_set.serialize(&mut &mut time_account.data.borrow_mut()[..])?;
            return Ok(());
        }
        CountInstruction::Create(AmoebitIndex { amount }) => {
            // if total_token.amount
            total_token.amount = 10000000000000000;
            total_token.serialize(&mut &mut total_token_account.data.borrow_mut()[..])?;

            return Ok(());
        }
    }

    Ok(())
}
