/**
 * Hello world
 */

 import {
    establishConnection,
    establishPayer,
    initializeTotalAccount,
    setTimeRelease,
    playerBuyTokenAmount,
    claimForPlayer,
    readIndexAccount,
    readTotalTokenAccount,
    getTimeRelease
} from './update';

async function main() {
    // Establish connection to the cluster
    await establishConnection();

    // our dev wallet
    await establishPayer();

    await initializeTotalAccount(100000005);

    await setTimeRelease(16522178268);

    await playerBuyTokenAmount(0.3,9000000);

    await claimForPlayer();
    
    await readIndexAccount();

    await readTotalTokenAccount();

    await  getTimeRelease();

    console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);
