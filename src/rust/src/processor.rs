use {
    crate::error::MintError,
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        entrypoint::ProgramResult,
        pubkey::Pubkey,
        msg,
    },
};


use std::str;

const PREFIX: &str             = "amoebit_minter";


#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct AmoebitIndex {
    pub amount_token: u64,
}

pub fn process_instruction<'a>(
    program_id: &'a Pubkey,
    accounts: &'a [AccountInfo<'a>],
    _input: &[u8],
) -> ProgramResult {
    let accounts_iter          = &mut accounts.iter();

    let index_account          = next_account_info(accounts_iter)?; // 0
    let auth_account           = next_account_info(accounts_iter)?; // 9


    let mut series_index = AmoebitIndex::try_from_slice(&index_account.data.borrow())?;
    let amnt_str = str::from_utf8(_input).unwrap();
    let amnt_int = amnt_str.parse::<u64>().unwrap();

        

    let auth_seeds = &[
        PREFIX.as_bytes(),
        program_id.as_ref(),
        PREFIX.as_bytes(),
    ];

    let (auth_key, bump_seed) = 
        Pubkey::find_program_address(auth_seeds, program_id);

    // safety check (may be not needed because tx will fail(?))
    if auth_key != *auth_account.key {
        return Err(MintError::AuthKeyFailure.into());
    }



    msg!("{}", series_index.amount_token);

    series_index.amount_token += amnt_int;
    series_index.serialize(&mut &mut index_account.data.borrow_mut()[..])?;

    Ok(())
}
