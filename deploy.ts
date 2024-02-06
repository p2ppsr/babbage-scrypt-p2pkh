import { P2PKH as Demo } from './src/contracts/demo'
import { bsv, SmartContract, Addr, Sig, PubKey, toByteString } from 'scrypt-ts'
import { deployContract, listContracts, redeemContract } from 'babbage-scrypt-helpers'

async function main() {
    await Demo.compile()
    const key = bsv.PrivateKey.fromHex('0000000000000000000000000000000000000000000000000000000000000001', bsv.Networks.testnet)
    const address = key.toAddress()
    const instance = new Demo(Addr(address.toByteString()))
    const deployTX = await deployContract(
        instance,
        1000,
        'Deploy a smart contract',
        'tests6'
    )
    console.log('deployed', deployTX.txid)
    const contracts = await listContracts('tests6', (lockingScript: string) => {
        return Demo.fromLockingScript(lockingScript) as Demo
    })
    console.log('listed', contracts)
    const redeemHydrator = (self: SmartContract): void => {
        const bsvtx = new bsv.Transaction()
        bsvtx.from(
            {
                txId: contracts[0].txid,
                outputIndex: contracts[0].vout,
                script: contracts[0].outputScript,
                satoshis: contracts[0].amount
            }
        )

        const signature = bsv.Transaction.Sighash.sign(
            bsvtx,
            key,
            bsv.crypto.Signature.SIGHASH_NONE | bsv.crypto.Signature.SIGHASH_ANYONECANPAY | bsv.crypto.Signature.SIGHASH_FORKID,
            0,
            bsv.Script.fromBuffer(Buffer.from(contracts[0].outputScript, 'hex')),
            new bsv.crypto.BN(parseInt(String(contracts[0].amount)))
        )
        console.log(signature)
        console.log(signature.toTxFormat().toString('hex'))
        console.log(Sig(toByteString(signature.toTxFormat().toString('hex'))))
        self.to = {
            tx: bsvtx,
            inputIndex: 0
        }

            ; (self as Demo).unlock(
                Sig(toByteString(signature.toTxFormat().toString('hex'))),
                PubKey(toByteString(key.publicKey.toString()))
            )
    }
    const hex = await contracts[0].contract.getUnlockingScript(redeemHydrator).toHex()
    console.log(hex)
    const redeemTX = await redeemContract(
        contracts[0],
        redeemHydrator,
        'redeem a smart contract'
    )
    console.log('REDEEMED!!', redeemTX.txid)
}

main()
