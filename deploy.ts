import { P2PKH as Demo } from './src/contracts/demo'
import { bsv, SmartContract, Addr, Sig, PubKey, toByteString } from 'scrypt-ts'
import { deployContract, listContracts, redeemContract } from 'babbage-scrypt-helpers'
import { getPublicKey, createSignature } from '@babbage/sdk-ts'
import crypto from 'crypto'

async function main() {
    const keyID = crypto.randomBytes(32).toString('base64')
    await Demo.compile()
    const publicKey = await getPublicKey({
        protocolID: 'demo',
        keyID
    })
    const address = bsv.PublicKey.fromString(publicKey).toAddress()
    const instance = new Demo(Addr(address.toByteString()))
    const deployTX = await deployContract(
        instance,
        1000,
        'Deploy a smart contract',
        'tests6',
        keyID
    )
    console.log('deployed', deployTX.txid)
    const contracts = await listContracts('tests6', (lockingScript: string) => {
        return Demo.fromLockingScript(lockingScript) as Demo
    })
    console.log('listed', contracts)
    const redeemHydrator = async (self: SmartContract): Promise<void> => {
        const instance = self as Demo
        const bsvtx = new bsv.Transaction()
        bsvtx.from({
            txId: contracts[0].txid,
            outputIndex: contracts[0].vout,
            script: contracts[0].outputScript,
            satoshis: contracts[0].amount
        })

        const hashType = bsv.crypto.Signature.SIGHASH_NONE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID
        const hashbuf = bsv.crypto.Hash.sha256(bsv.Transaction.Sighash.sighashPreimage(
            bsvtx,
            hashType,
            0,
            bsv.Script.fromBuffer(Buffer.from(contracts[0].outputScript, 'hex')),
            new bsv.crypto.BN(parseInt(String(contracts[0].amount)))
        ))
        const SDKSignature = await createSignature({
            protocolID: 'demo',
            keyID: contracts[0].customInstructions as string,
            data: hashbuf
        })
        const signature = bsv.crypto.Signature.fromString(Buffer.from(SDKSignature).toString('hex'))
        signature.nhashtype = hashType

        self.to = {
            tx: bsvtx,
            inputIndex: 0
        }
        instance.unlock(
            Sig(toByteString(signature.toTxFormat().toString('hex'))),
            PubKey(toByteString(publicKey))
        )
    }
    const redeemTX = await redeemContract(
        contracts[0],
        redeemHydrator,
        'redeem a smart contract'
    )
    console.log('REDEEMED!!', redeemTX.txid)
}

main()
