import { P2PKH as Demo } from '../src/contracts/demo';
import { bsv, SmartContract, Addr, Sig, PubKey, toByteString } from 'scrypt-ts';
import {
  deployContract,
  listContracts,
  redeemContract,
} from 'babbage-scrypt-helpers';
import { getPublicKey, createSignature } from '@babbage/sdk-ts';
import crypto from 'crypto';
import Whatsonchain from 'whatsonchain';
import chaiAsPromised from 'chai-as-promised';
import { expect, use } from 'chai';

use(chaiAsPromised);

let satoshis: number;
let woc: Whatsonchain;
let result: { headers: number };
let currentBlockHeight: number;
let lockBlockHeight: number;

describe('Test SmartContract `Demo`', () => {
  let instance: Demo;

  beforeEach(async () => {
    console.log('Test Loolocks SmartContract `Demo`:before');
    satoshis = 3000;
    woc = new Whatsonchain('testnet');
    result = await woc.chainInfo();
    lockBlockHeight = result.headers + 1;
    console.log('Test Loolocks SmartContract `Demo`:lockBlockHeight=', lockBlockHeight);

    await Demo.loadArtifact();

    const keyID = crypto.randomBytes(32).toString('base64');
    await Demo.compile();
    const publicKey = await getPublicKey({
      protocolID: 'demos',
      keyID,
    });
    const address = bsv.PublicKey.fromString(publicKey).toAddress();
    instance = new Demo(Addr(address.toByteString()), BigInt(satoshis), BigInt(lockBlockHeight));
    const deployTX = await deployContract(
      instance,
      satoshis,
      'Deploy a loolock smart contract',
      'testhl3',
      keyID
    );
    console.log('deployed', deployTX.txid);
  });

	let i = 0; // Declare i outside the redeem function

  it('should pass the public method unit test successfully.', async () => {
    await new Promise<void>((resolve) => {
      const redeem = async () => {
        console.log('redeem():min:', i);
        const result = await woc.chainInfo();
        const currentBlockHeight = result.headers;
        console.log(currentBlockHeight, '<', lockBlockHeight);
        if (currentBlockHeight <= lockBlockHeight) {
          jest.advanceTimersByTime(60000);
          setTimeout(redeem, 0);
        } else {
          const contracts = await listContracts('testhl3', (lockingScript: string) => {
            return Demo.fromLockingScript(lockingScript) as Demo;
          });
          console.log('listed', contracts);
          const redeemHydrator = async (self: SmartContract): Promise<void> => {
            const instance = self as Demo;
            const bsvtx = new bsv.Transaction();
            bsvtx.from({
              txId: contracts[0].txid,
              outputIndex: contracts[0].vout,
              script: contracts[0].outputScript,
              satoshis: contracts[0].amount,
            });

            const hashType =
              bsv.crypto.Signature.SIGHASH_NONE |
              bsv.crypto.Signature.SIGHASH_ANYONECANPAY |
              bsv.crypto.Signature.SIGHASH_FORKID;
            const hashbuf = bsv.crypto.Hash.sha256(
              bsv.Transaction.Sighash.sighashPreimage(
                bsvtx,
                hashType,
                0,
                bsv.Script.fromBuffer(Buffer.from(contracts[0].outputScript, 'hex')),
                new bsv.crypto.BN(parseInt(String(contracts[0].amount)))
              )
            );
            const keyID = contracts[0].customInstructions as string;
            const SDKSignature = await createSignature({
              protocolID: 'demos',
              keyID,
              data: hashbuf,
            });
            const signature = bsv.crypto.Signature.fromString(
              Buffer.from(SDKSignature).toString('hex')
            );
            signature.nhashtype = hashType;

            self.to = {
              tx: bsvtx,
              inputIndex: 0,
            };
            const publicKey = await getPublicKey({
              protocolID: 'demos',
              keyID,
            });
            instance.unlock(
              Sig(toByteString(signature.toTxFormat().toString('hex'))),
              PubKey(toByteString(publicKey))
            );
          };

          const call = async () => {
            const redeemTX = await redeemContract(
              contracts[0],
              redeemHydrator,
              'redeem a smart contract'
            );
            console.log('REDEEMED!!', redeemTX.txid);
          };
          await expect(call()).not.to.be.rejected;
          resolve();
        }
      };

      redeem();
    });
  });
});
