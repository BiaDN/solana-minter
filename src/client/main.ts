/**
 * Hello world
 */

import {
    establishConnection,
    establishPayer,
    checkAccounts,
    testContract,
    testContract2,
    readIndexAccount,
    readTotalTokenAccount,
    getTimeRelease,
    created,
} from './amoebit_init';

async function main() {
    // Establish connection to the cluster
    await establishConnection();

    // our dev wallet
    await establishPayer();

    await checkAccounts();
    // init the index account
    // await created();

    // run the contract
    await testContract();

    await testContract2(1651846229527);

    // Find out how many times the contract has ran successfully
    await readIndexAccount();
    
    //
    await readTotalTokenAccount();

    await getTimeRelease();
    console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
