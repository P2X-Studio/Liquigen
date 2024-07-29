"use client";

// ShadCN Imports
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Form Imports
import { useForm } from "react-hook-form";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Ethereum Imports
import { Address } from "viem";
import { useWriteContract, useAccount, type BaseError } from "wagmi";
import ERC20 from "@/contracts/ERC20.json";
import LPNFTPAIR from "@/contracts/KimLPNFTPair.json";
import Link from "next/link";
import { ethers } from "ethers";
import { useClient } from "wagmi";

enum Status {
  "Idle",
  "Minting",
  "Transferring Token0",
  "Transferring Token1",
  "Confirming Transaction",
}

export default function DepositToPairCard({
  token0,
  token1,
  lpnftPairAddress,
}: {
  token0: Address | undefined;
  token1: Address | undefined;
  lpnftPairAddress: Address | undefined;
}) {
  // Setup state Variables
  const [token0Transfered, setToken0Transfered] = useState(false);
  const [token1Transfered, setToken1Transfered] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completedHash, setCompletedHash] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>(Status["Idle"]);

  const client = useClient();
  // Check if the client is connected
  if (!client) {
    throw new Error("No connected client");
  }
  // Setup provider using ethers
  const url = client.chain.rpcUrls.default.http[0];
  const provider = new ethers.JsonRpcProvider(url);

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Form Setup ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  const DepositToPairSchema = z.object({
    amount: z.coerce
      .number({ required_error: "Provide amount to deposit" })
      .min(0.0000001, { message: "Amount must be greater than 0" }),
  });

  const depositForm = useForm<z.infer<typeof DepositToPairSchema>>({
    resolver: zodResolver(DepositToPairSchema),
    defaultValues: {
      amount: 1,
    },
  });
  type DepositToPairValues = z.infer<typeof DepositToPairSchema>;

  // ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ Ethereum Interactions setup ~~~~~~~~~~~~~~~~~~~~~~~~~
  const { writeContractAsync, isPending, error } = useWriteContract();
  const account = useAccount();

  // Helper functions
  function reset() {
    setStatus(Status["Idle"]);
  }
  function toastError(error: any) {
    toast(`Error during deposit`, {
      style: { color: "red" },
      action: "Close",
      description: (error as BaseError).shortMessage || error.message,
    });
  }
  function toastSuccess() {
    toast(`Successfully deposited tokens`, {
      style: { color: "green" },
      action: "Close",
    });
  }

  // Transfer token0 and token1 to the pair
  async function transferToken0(amount: number) {
    console.log("Token0 : ", token0);
    // Transfer token0 amount to the pair
    setStatus(Status["Transferring Token0"]);
    const txHash = await writeContractAsync({
      address: token0 as Address,
      abi: ERC20,
      functionName: "transfer",
      args: [lpnftPairAddress, ethers.parseUnits(amount.toString(), 18)],
    });

    if (!txHash) {
      throw new Error("Transaction failed for token0 transfer");
    }

    setStatus(Status["Confirming Transaction"]);
    const receipt = await provider.waitForTransaction(txHash); // Wait for the transaction to be confirmed
    if (receipt && receipt.status === 1) {
      setToken0Transfered(true);
    }
    setStatus(Status["Idle"]);
    return receipt;
  }

  async function transferToken1(amount: number) {
    console.log("Token1 : ", token1);
    // Transfer token1 amount to the pair
    setStatus(Status["Transferring Token1"]);
    const txHash = await writeContractAsync({
      address: token1 as Address,
      abi: ERC20,
      functionName: "transfer",
      args: [lpnftPairAddress, ethers.parseUnits(amount.toString(), 18)],
    });

    if (!txHash) {
      throw new Error("Transaction failed for token1 transfer");
    }

    setStatus(Status["Confirming Transaction"]);
    const receipt = await provider.waitForTransaction(txHash); // Wait for the transaction to be confirmed
    if (receipt && receipt.status === 1) {
      setToken1Transfered(true);
    }
    setStatus(Status["Idle"]);
    return receipt;
  }

  // Mints LP404
  async function mint() {
    setStatus(Status["Minting"]);
    // Mint LP404 from the pair to the user
    const txHash = await writeContractAsync({
      address: lpnftPairAddress as Address,
      abi: LPNFTPAIR.abi,
      functionName: "mint",
      args: [account.address],
    });

    if (!txHash) {
      throw new Error("Transaction failed for minting");
    }

    setStatus(Status["Confirming Transaction"]);
    const receipt = await provider.waitForTransaction(txHash); // Wait for the transaction to be confirmed
    if (receipt && receipt.status === 1) {
      setToken0Transfered(false);
      setToken1Transfered(false);
      setStatus(Status["Idle"]);
      setCompletedHash(txHash);
      setCompleted(true);
    }
  }

  // Deposits liquidity to the pair
  async function depositLiquidity(data: DepositToPairValues) {
    if (data.amount != 0) {
      try {
        if (!token0Transfered) {
          await transferToken0(data.amount);
        }
        if (!token1Transfered) {
          await transferToken1(data.amount);
        }
        await mint();
        toastSuccess();
      } catch (e: any) {
        toastError(e);
        console.error("Error during deposit:", error);
        reset();
      }
    }
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Deposit to LPNFT Pair</CardTitle>
        <CardDescription>
          Enter amount you wish to deposit to the Pair.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...depositForm}>
          <form onSubmit={depositForm.handleSubmit(depositLiquidity)}>
            <div className="grid gap-4">
              <FormField
                control={depositForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>{" "}
                    <FormControl>
                      <Input type="number" step="any" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="w-full flex items-center justify-between gap-6">
                <Button
                  disabled={
                    isPending || status === Status["Confirming Transaction"]
                  }
                  type="submit"
                  className="w-full bg-green-600"
                >
                  {(status === Status["Transferring Token0"] &&
                    "Depositing Token0...") ||
                    (status === Status["Transferring Token1"] &&
                      "Depositing Token1...") ||
                    (status === Status["Minting"] && "Minting LP Token...") ||
                    (status === Status["Idle"] && "Deposit") ||
                    "Deposit"}
                </Button>
              </div>
              <div className="w-full">
                {completed && completedHash && (
                  <Link
                    href={`https://sepolia.explorer.mode.network/tx/${completedHash}`}
                    className="text-blue-500"
                    target="blank"
                  >
                    Transaction Hash: {completedHash.substring(0, 10) + "..."}
                  </Link>
                )}
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
