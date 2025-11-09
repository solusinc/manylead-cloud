"use client";

import { Kbd } from "~/components/common/kbd";
import { Button } from "@manylead/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@manylead/ui/popover";
import { Textarea } from "@manylead/ui/textarea";
import { useSidebar } from "@manylead/ui/sidebar";
import { useEffect, useState } from "react";
// TODO: Implement TRPC and react-hook-form
// import { useTRPC } from "~/lib/trpc/client";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { useMutation } from "@tanstack/react-query";
// import { useForm } from "react-hook-form";
// import { toast } from "sonner";
// import { z } from "zod";
// import { AudioLines, Inbox, LoaderCircle, Mic } from "lucide-react";
// import {
//   Form,
//   FormControl,
//   FormField,
//   FormItem,
//   FormLabel,
// } from "@manylead/ui/form";

// TODO: Implement Zod schema for feedback form
// const schema = z.object({
//   message: z.string().min(1),
// });

export function NavFeedback() {
  const [open, setOpen] = useState(false);
  const { isMobile } = useSidebar();
  const [message, setMessage] = useState("");

  // TODO: Implement react-hook-form
  // const form = useForm<z.infer<typeof schema>>({
  //   resolver: zodResolver(schema),
  //   defaultValues: {
  //     message: "",
  //   },
  // });

  // TODO: Implement TRPC mutation for feedback submission
  // const trpc = useTRPC();
  // const feedbackMutation = useMutation(trpc.feedback.submit.mutationOptions());

  // TODO: Implement SpeechRecognition for voice input (optional)
  // const [isListening, setIsListening] = useState(false);
  // const recognitionRef = useRef<SpeechRecognition | null>(null);

  // TODO: Implement SpeechRecognition setup (optional feature)
  // useEffect(() => {
  //   if (typeof window === "undefined") return;
  //
  //   const SpeechRecognitionCtor =
  //     (window as any).webkitSpeechRecognition ||
  //     (window as any).SpeechRecognition;
  //
  //   if (!SpeechRecognitionCtor) return;
  //
  //   const recognition: SpeechRecognition = new SpeechRecognitionCtor();
  //   recognition.lang = "en-US";
  //   recognition.continuous = false;
  //   recognition.interimResults = false;
  //
  //   recognition.onresult = (event: SpeechRecognitionEvent) => {
  //     const transcript = Array.from(event.results)
  //       .map((r) => r[0].transcript)
  //       .join(" ");
  //     form.setValue(
  //       "message",
  //       `${form.getValues("message") ?? ""}${transcript} `,
  //     );
  //   };
  //
  //   recognition.onend = () => {
  //     setIsListening(false);
  //   };
  //
  //   recognitionRef.current = recognition;
  // }, [form]);

  // TODO: Implement voice input toggle (optional feature)
  // const toggleListening = () => {
  //   const recognition = recognitionRef.current;
  //   if (!recognition) return;
  //   if (isListening) {
  //     recognition.stop();
  //   } else {
  //     try {
  //       recognition.start();
  //       setIsListening(true);
  //     } catch {
  //       // recognition already started, ignore
  //     }
  //   }
  // };

  // TODO: Implement TRPC mutation with toast notifications
  // const onSubmit = useCallback(
  //   async (values: z.infer<typeof schema>) => {
  //     const promise = feedbackMutation.mutateAsync({
  //       ...values,
  //       path: window.location.pathname,
  //       isMobile,
  //     });
  //     toast.promise(promise, {
  //       loading: "Sending feedback...",
  //       success: "Feedback sent",
  //       error: "Failed to send feedback",
  //     });
  //     await promise;
  //   },
  //   [feedbackMutation, isMobile],
  // );

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Replace with TRPC mutation
    console.log("Feedback:", message);
    setMessage("");
    setOpen(false);
  };

  // TODO: Reset mutation state when popover closes
  // useEffect(() => {
  //   if (!open && feedbackMutation.isSuccess) {
  //     setTimeout(() => feedbackMutation.reset(), 300);
  //   }
  // }, [open, feedbackMutation]);

  // Keyboard shortcuts: F to open, Cmd+Enter to submit
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // TODO: Implement Cmd+Enter to submit when using react-hook-form
      // if (open && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
      //   form.handleSubmit(onSubmit)();
      // }

      const target = e.target as HTMLElement;
      const isTyping =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTyping) return;

      if (!open) {
        if (e.key === "f") {
          e.preventDefault();
          setOpen(true);
        }
        return;
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  // TODO: Reset form when popover closes (implement with react-hook-form to avoid cascading renders)
  // useEffect(() => {
  //   if (!open) {
  //     form.reset();
  //   }
  // }, [open, form]);

  if (isMobile) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="group gap-0 px-2 text-muted-foreground text-sm hover:bg-transparent hover:text-foreground data-[state=open]:text-foreground"
        >
          Feedback{" "}
          <Kbd className="font-mono group-hover:text-foreground group-data-[state=open]:text-foreground">
            F
          </Kbd>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="relative border-none p-0">
        {/* TODO: Show success state when feedbackMutation.isSuccess */}
        {/* {feedbackMutation.isSuccess ? (
          <div className="flex h-[110px] flex-col items-center justify-center gap-1 rounded-md border border-input p-3 text-base shadow-xs">
            <Inbox className="size-4 shrink-0" />
            <p className="text-center font-medium">Thanks for sharing!</p>
            <p className="text-center text-muted-foreground text-sm">
              We&apos;ll get in touch if there&apos;s a follow-up.
            </p>
          </div>
        ) : ( */}
        <form onSubmit={onSubmit}>
          {/* TODO: Wrap with Form component from react-hook-form */}
          {/* <Form {...form}>
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="sr-only">Feedback</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ideas, bugs, or anything else..."
                      className="field-sizing-fixed h-[110px] resize-none p-3"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </Form> */}
          <Textarea
            placeholder="Ideas, bugs, or anything else..."
            className="field-sizing-fixed h-[110px] resize-none p-3"
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {/* TODO: Add voice input button (optional feature) */}
          {/* {recognitionRef.current && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="group absolute bottom-1.5 left-1.5 gap-0"
              onClick={toggleListening}
            >
              {isListening ? (
                <AudioLines className="size-4 animate-pulse" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>
          )} */}
          <Button
            size="sm"
            variant="ghost"
            className="group absolute right-1.5 bottom-1.5 gap-0"
            type="submit"
            // TODO: Add disabled state when mutation is pending
            // disabled={feedbackMutation.isPending}
          >
            {/* TODO: Show loading spinner when mutation is pending */}
            {/* {feedbackMutation.isPending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : ( */}
            <>
              Send
              <Kbd className="font-mono group-hover:text-foreground">⌘</Kbd>
              <Kbd className="font-mono group-hover:text-foreground">↵</Kbd>
            </>
            {/* )} */}
          </Button>
        </form>
        {/* )} */}
      </PopoverContent>
    </Popover>
  );
}
